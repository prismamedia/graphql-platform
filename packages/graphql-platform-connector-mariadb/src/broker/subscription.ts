import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import assert from 'node:assert';
import type {
  MariaDBBroker,
  MariaDBBrokerMutation,
  MariaDBBrokerSubscriptionsStateTable,
} from '../broker.js';

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

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly subscription: core.ChangesSubscriptionStream,
  ) {
    super();

    this.#signal = subscription.signal;

    this.stateTable = broker.connector.schema.getTableByNode(
      subscription.node,
    ).subscriptionsStateTable;
  }

  public notify(mutations: ReadonlyArray<MariaDBBrokerMutation>): void {
    assert(mutations.length);

    this.emit('assignments', mutations).catch((cause) =>
      this.broker.connector.emit(
        'error',
        new Error(
          `Failed to notify the subscription ${this.subscription.id} of the ${mutations.length} assignment(s)`,
          { cause },
        ),
      ),
    );
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.off();

    await Promise.all([
      this.broker.unsubscribe(this.subscription),
      this.broker.assignmentsTable.unsubscribe(this.subscription.id),
      this.stateTable?.unsubscribe(this.subscription.id),
    ]);
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

        yield* this.broker.changesTable.getChanges(this.subscription, mutation);

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
}
