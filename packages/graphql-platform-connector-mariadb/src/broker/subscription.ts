import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { setTimeout } from 'node:timers/promises';
import type { MariaDBBroker } from '../broker.js';
import { escapeIdentifier } from '../escaping.js';
import { TimestampType } from '../schema/table/data-type/date-and-time/timestamp.js';

export const msTimestampType = new TimestampType({ microsecondPrecision: 3 });

export type MariaDBSubscriptionEvents = {
  idle: undefined;
};

export class MariaDBSubscription
  extends AsyncEventEmitter<MariaDBSubscriptionEvents>
  implements core.NodeChangeSubscriptionInterface
{
  readonly #subscribedAt: Date = new Date();
  readonly #signal: AbortSignal;

  #idle?: boolean;

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly subscription: core.ChangesSubscriptionStream,
  ) {
    super();

    this.#signal = subscription.signal;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.off();
    await this.broker.unsubscribe(this.subscription);
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    core.MutationContextChanges,
    undefined
  > {
    let processingRequest:
      | Readonly<{ id: bigint; context: string }>
      | undefined;

    let processingChanges: ReadonlyArray<{
      requestId: bigint;
      id: bigint;
      node: string;
      kind: utils.MutationType;
      oldValue: string | null;
      newValue: string | null;
      executedAt: string;
      committedAt: string;
    }>;

    let processedRequestId: bigint | undefined;
    do {
      [processingRequest] = await this.broker.connector.executeQuery<
        { id: bigint; context: string }[]
      >(
        `
          SELECT ${['id', 'context'].map(escapeIdentifier).join()}
          FROM ${escapeIdentifier(this.broker.requestsTableName)}
          WHERE ${processedRequestId ? `${escapeIdentifier('id')} > ?` : `${escapeIdentifier('committedAt')} >= ?`}
          ORDER BY ${escapeIdentifier('id')} ASC
          LIMIT 1
        `,
        [processedRequestId ?? msTimestampType.format(this.#subscribedAt)],
      );

      if (processingRequest) {
        this.#idle = false;

        const requestContext = this.broker.options?.unserializeRequestContext
          ? this.broker.options.unserializeRequestContext(
              JSON.parse(processingRequest.context),
            )
          : JSON.parse(processingRequest.context);

        let processedChangeId: bigint | undefined;
        do {
          processingChanges = await this.broker.connector.executeQuery<
            {
              requestId: bigint;
              id: bigint;
              node: string;
              kind: utils.MutationType;
              oldValue: string | null;
              newValue: string | null;
              executedAt: string;
              committedAt: string;
            }[]
          >(
            `
              SELECT *
              FROM ${escapeIdentifier(this.broker.changesByRequestTableName)}
              WHERE ${[`${escapeIdentifier('requestId')} = ?`, processedChangeId ? `${escapeIdentifier('id')} > ?` : undefined].filter(Boolean).join(' AND ')}
              ORDER BY ${escapeIdentifier('id')} ASC
              LIMIT ?
            `,
            [
              processingRequest.id,
              processedChangeId,
              this.broker.batchSize,
            ].filter(Boolean),
          );

          if (processingChanges.length) {
            const changes = processingChanges.map(({ kind, ...change }) => {
              const node = this.broker.connector.gp.getNodeByName(change.node);
              const executedAt = msTimestampType.parseColumnValue(
                change.executedAt,
              );
              const committedAt = msTimestampType.parseColumnValue(
                change.committedAt,
              );

              return kind === utils.MutationType.CREATION
                ? new core.NodeCreation(
                    node,
                    requestContext,
                    change.newValue
                      ? node.selection.unserialize(JSON.parse(change.newValue))
                      : undefined,
                    executedAt,
                    committedAt,
                  )
                : kind === utils.MutationType.UPDATE
                  ? new core.NodeUpdate(
                      node,
                      requestContext,
                      change.oldValue
                        ? node.selection.unserialize(
                            JSON.parse(change.oldValue),
                          )
                        : undefined,
                      change.newValue
                        ? node.selection.unserialize(
                            JSON.parse(change.newValue),
                          )
                        : undefined,
                      executedAt,
                      committedAt,
                    )
                  : new core.NodeDeletion(
                      node,
                      requestContext,
                      change.oldValue
                        ? node.selection.unserialize(
                            JSON.parse(change.oldValue),
                          )
                        : undefined,
                      executedAt,
                      committedAt,
                    );
            });

            yield new core.MutationContextChanges(requestContext, changes);

            processedChangeId = processingChanges.at(-1)!.id;
          }
        } while (
          processingChanges.length === this.broker.batchSize &&
          !this.#signal.aborted
        );

        processedRequestId = processingRequest.id;
      } else if (!this.#idle) {
        this.#idle = true;
        this.emit('idle', undefined);
      }
    } while (
      !this.#idle ||
      (await setTimeout(this.broker.pullInterval * 1000, true, {
        signal: this.#signal,
      }).catch(() => false))
    );
  }

  public onIdle(
    listener: EventListener<MariaDBSubscriptionEvents, 'idle'>,
  ): void {
    this.on('idle', listener, this.#signal);
  }

  public async waitForIdle(): Promise<void> {
    this.#idle || (await this.wait('idle', this.#signal));
  }
}
