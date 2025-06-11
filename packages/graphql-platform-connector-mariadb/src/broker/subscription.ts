import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  MariaDBBroker,
  MariaDBBrokerMutation,
  MariaDBBrokerSubscriptionsStateTable,
} from '../broker.js';
import { BrokerError, BrokerErrorCode } from './error.js';
import { MariaDBSubscriptionDiagnosis } from './subscription/diagnosis.js';
import { MariaDBSubscriptionError } from './subscription/error.js';

export * from './subscription/diagnosis.js';
export * from './subscription/error.js';

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
  /**
   * The last mutation's id that has been visited by this subscription.
   */
  public lastVisitedMutationId?: bigint;

  #idle?: boolean;
  readonly #signal: AbortSignal;

  public readonly stateTable?: MariaDBBrokerSubscriptionsStateTable;

  readonly #assigner: NodeJS.Timeout;
  #assigning?: Promise<void>;

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly subscription: core.ChangesSubscriptionStream,
  ) {
    super();

    this.#signal = subscription.signal;

    this.stateTable = broker.connector.schema.getTableByNode(
      subscription.node,
    ).subscriptionsStateTable;

    this.#assigner = setInterval(
      () =>
        this.assign().catch((cause) =>
          this.emit(
            'error',
            new BrokerError({ code: BrokerErrorCode.ASSIGNER, cause }),
          ),
        ),
      this.broker.assignerIntervalInSeconds * 1000,
    );
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    clearInterval(this.#assigner);
    this.off();

    await utils.PromiseAllSettledThenThrowIfErrors([
      this.broker.unsubscribe(this.subscription),
      this.broker.assignmentsTable.unsubscribe(this.subscription.id),
      this.stateTable?.unsubscribe(this.subscription.id),
    ]);
  }

  public assign(): Promise<void> {
    return (this.#assigning ??= new Promise<void>(async (resolve, reject) => {
      try {
        for await (const mutations of this.broker.mutationsTable.getAssignables(
          this,
        )) {
          await this.broker.assignmentsTable.assign(
            this.subscription.id,
            mutations,
          );

          await this.emit('assignments', mutations);
        }

        resolve();
      } catch (error) {
        reject(error);
      } finally {
        this.#assigning = undefined;
      }
    }));
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    core.MutationContextChanges,
    undefined
  > {
    do {
      for await (const mutation of this.broker.assignmentsTable.dequeue(
        this.subscription.id,
      )) {
        this.#idle = false;
        await this.emit('processing', mutation);

        yield* this.broker.changesTable.getChanges(this, mutation);

        await this.emit('processed', mutation);
      }

      this.#idle = true;
    } while (
      !this.#signal.aborted &&
      (
        await Promise.all([
          this.emit('idle', undefined),
          this.wait('assignments', this.#signal).catch(() => []),
        ])
      )[1].length
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

  public async diagnose(): Promise<MariaDBSubscriptionDiagnosis> {
    this.subscription.signal.throwIfAborted();

    const startedAt = new Date();

    try {
      const [assigned, unassigned] = await Promise.all([
        this.broker.assignmentsTable.diagnose(this),
        this.broker.mutationsTable.diagnose(this),
      ]);

      return new MariaDBSubscriptionDiagnosis(
        this,
        assigned,
        unassigned,
        startedAt,
      );
    } catch (cause) {
      throw new MariaDBSubscriptionError(
        this,
        `Failed while diagnosing the subscription "${this.subscription.id}"`,
        { cause },
      );
    }
  }
}
