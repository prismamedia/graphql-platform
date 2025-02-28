import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import Denque from 'denque';
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
   * The last mutation's id that has been assigned to this subscription.
   */
  public lastAssignedMutationId?: bigint;

  #idle?: boolean;
  readonly #signal: AbortSignal;
  readonly #assignments: Denque<MariaDBBrokerMutation>;

  public readonly stateTable?: MariaDBBrokerSubscriptionsStateTable;

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly subscription: core.ChangesSubscriptionStream,
  ) {
    super();

    this.#signal = subscription.signal;
    this.#assignments = new Denque();

    this.stateTable = broker.connector.schema.getTableByNode(
      subscription.node,
    ).subscriptionsStateTable;
  }

  public async assign(
    mutations: ReadonlyArray<MariaDBBrokerMutation>,
  ): Promise<void> {
    if (mutations.length) {
      this.lastAssignedMutationId = mutations.at(-1)!.id;
      mutations.forEach((mutation) => this.#assignments.push(mutation));
      await this.emit('assignments', mutations);
    }
  }

  public async dequeue(): Promise<MariaDBBrokerMutation | undefined> {
    return (
      this.#assignments.shift() ||
      ((await this.wait('assignments', this.#signal).catch(() => undefined)) &&
        this.dequeue())
    );
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.off();

    try {
      await Promise.all([
        this.broker.unsubscribe(this.subscription),
        this.broker.assignmentsTable.unsubscribe(this.subscription.id),
        this.stateTable?.unsubscribe(this.subscription.id),
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
    while ((mutation = await this.dequeue()) && !this.#signal.aborted) {
      this.#idle = false;
      await this.emit('processing', mutation);

      yield* this.broker.changesTable.getChanges(this.subscription, mutation);

      await Promise.all([
        this.broker.assignmentsTable.unassign(
          this.subscription.id,
          mutation.id,
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
