import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import Denque from 'denque';
import { randomUUID, type UUID } from 'node:crypto';
import type {
  MariaDBBroker,
  MariaDBBrokerMutation,
  SerializedMariaDBBrokerChange,
} from '../broker.js';
import { escapeIdentifier, escapeStringValue } from '../escaping.js';
import { TimestampType } from '../schema/table/data-type/date-and-time/timestamp.js';
import { AND, OR } from '../statement/manipulation/clause/where-condition.js';

export const msTimestampType = new TimestampType({ microsecondPrecision: 3 });

export type MariaDBSubscriptionEvents = {
  assignments: ReadonlyArray<MariaDBBrokerMutation>;
  processing: MariaDBBrokerMutation;
  processed: MariaDBBrokerMutation;
  idle: undefined;
};

export class MariaDBSubscription
  extends AsyncEventEmitter<MariaDBSubscriptionEvents>
  implements core.NodeChangeSubscriptionInterface
{
  #idle?: boolean;

  public readonly id: UUID = randomUUID();
  public assignedMutationId: bigint = 0n;

  readonly #signal: AbortSignal;
  readonly #assignments: Denque<MariaDBBrokerMutation>;

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly subscription: core.ChangesSubscriptionStream,
  ) {
    super();

    this.#signal = subscription.signal;
    this.#assignments = new Denque();
  }

  public async assign(
    mutations: ReadonlyArray<MariaDBBrokerMutation>,
  ): Promise<void> {
    if (mutations.length) {
      this.assignedMutationId = mutations.at(-1)!.id;
      mutations.forEach((mutation) => this.#assignments.push(mutation));
      await this.emit('assignments', mutations);
    }
  }

  public async dequeue(): Promise<MariaDBBrokerMutation | undefined> {
    return (
      this.#assignments.shift() ||
      ((await this.wait('assignments', this.#signal).catch(() => undefined)) &&
        this.#assignments.shift())
    );
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.off();

    try {
      await Promise.all([
        this.broker.unsubscribe(this.subscription),
        this.broker.connector.executeQuery(`
          DELETE FROM ${escapeIdentifier(this.broker.assignmentsTableName)}
          WHERE ${escapeIdentifier('subscriptionId')} = ${escapeStringValue(this.id)}
        `),
      ]);
    } finally {
      this.#assignments.clear();
    }
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    core.MutationContextChanges,
    undefined
  > {
    let mutation: MariaDBBrokerMutation | undefined;
    let serializedChanges: ReadonlyArray<SerializedMariaDBBrokerChange>;

    while ((mutation = await this.dequeue()) && !this.#signal.aborted) {
      this.#idle = false;
      await this.emit('processing', mutation);

      let processedChangeId: bigint = 0n;
      do {
        serializedChanges = await this.broker.connector.executeQuery<
          SerializedMariaDBBrokerChange[]
        >(
          `
            SELECT *
            FROM ${escapeIdentifier(this.broker.changesTableName)}
            WHERE ${AND([
              `${escapeIdentifier('mutationId')} = ${mutation.id}`,
              `${escapeIdentifier('id')} > ${processedChangeId}`,
              OR(
                Array.from(
                  this.subscription.dependencyGraph.flattened.byNode,
                  ([node, dependency]) =>
                    AND([
                      `${escapeIdentifier('node')} = ${escapeStringValue(node.name)}`,
                      OR([
                        dependency.creation || dependency.deletion
                          ? `${escapeIdentifier('kind')} IN (${[
                              dependency.creation &&
                                utils.MutationType.CREATION,
                              dependency.deletion &&
                                utils.MutationType.DELETION,
                            ]
                              .filter(utils.isNonNil)
                              .map((type) => escapeStringValue(type))
                              .join(',')})`
                          : undefined,
                        dependency.update
                          ? AND([
                              `${escapeIdentifier('kind')} = ${escapeStringValue(utils.MutationType.UPDATE)}`,
                              `JSON_OVERLAPS(
                                JSON_KEYS(${escapeIdentifier('newValue')}),
                                JSON_ARRAY(${Array.from(dependency.update, ({ name }) => escapeStringValue(name)).join(',')})
                              )`,
                            ])
                          : undefined,
                      ]),
                    ]),
                ),
              ),
            ])}
            ORDER BY ${escapeIdentifier('id')} ASC
            LIMIT ${this.broker.batchSize}
          `,
        );

        if (serializedChanges.length && !this.#signal.aborted) {
          const changes = serializedChanges.map(
            ({ kind, ...serializedChange }) => {
              const node = this.broker.connector.gp.getNodeByName(
                serializedChange.node,
              );
              const executedAt = msTimestampType.parseColumnValue(
                serializedChange.executedAt,
              );

              return kind === utils.MutationType.CREATION
                ? core.NodeCreation.unserialize(
                    node,
                    mutation!.requestContext,
                    serializedChange.newValue
                      ? JSON.parse(serializedChange.newValue)
                      : undefined,
                    executedAt,
                    mutation!.committedAt,
                  )
                : kind === utils.MutationType.UPDATE
                  ? core.NodeUpdate.unserialize(
                      node,
                      mutation!.requestContext,
                      serializedChange.oldValue
                        ? JSON.parse(serializedChange.oldValue)
                        : undefined,
                      serializedChange.newValue
                        ? JSON.parse(serializedChange.newValue)
                        : undefined,
                      executedAt,
                      mutation!.committedAt,
                    )
                  : core.NodeDeletion.unserialize(
                      node,
                      mutation!.requestContext,
                      serializedChange.oldValue
                        ? JSON.parse(serializedChange.oldValue)
                        : undefined,
                      executedAt,
                      mutation!.committedAt,
                    );
            },
          );

          yield new core.MutationContextChanges(
            mutation!.requestContext,
            changes,
          );

          processedChangeId = serializedChanges.at(-1)!.id;
        }
      } while (
        serializedChanges.length === this.broker.batchSize &&
        !this.#signal.aborted
      );

      await Promise.all([
        this.broker.connector.executeQuery(
          `
            DELETE FROM ${escapeIdentifier(this.broker.assignmentsTableName)}
            WHERE ${escapeIdentifier('mutationId')} = ${mutation.id}
              AND ${escapeIdentifier('subscriptionId')} = ${escapeStringValue(this.id)}
          `,
        ),
        this.emit('processed', mutation),
      ]);

      if (!this.#assignments.length) {
        this.#idle = true;
        await this.emit('idle', undefined);
      }
    }
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
