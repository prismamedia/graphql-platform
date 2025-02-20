import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import type { BrokerInterface } from '../broker-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type {
  ChangesSubscriptionStream,
  MutationContextChanges,
} from '../node.js';
import {
  InMemorySubscription,
  type InMemorySubscriptionEvents,
} from './in-memory/subscription.js';

export * from './in-memory/subscription.js';

export type InMemoryBrokerEvents = {
  subscription: InMemorySubscription;
  unsubscription: InMemorySubscription;
  idle: undefined;
};

export class InMemoryBroker
  extends AsyncEventEmitter<InMemoryBrokerEvents>
  implements BrokerInterface
{
  public readonly subscriptions = new Map<
    ChangesSubscriptionStream,
    InMemorySubscription
  >();

  public constructor(public readonly gp: GraphQLPlatform) {
    super();
  }

  public async publish(changes: MutationContextChanges): Promise<void> {
    await Promise.all(
      Array.from(this.subscriptions.values(), (queue) =>
        queue.enqueue(changes),
      ),
    );
  }

  public async subscribe(
    subscription: ChangesSubscriptionStream,
  ): Promise<InMemorySubscription> {
    const worker = new InMemorySubscription(this, subscription);

    this.subscriptions.set(subscription, worker);
    await this.emit('subscription', worker);

    return worker;
  }

  public onIdle(
    subscription: ChangesSubscriptionStream,
    listener: EventListener<InMemorySubscriptionEvents, 'idle'>,
  ): void {
    this.subscriptions.get(subscription)?.onIdle(listener);
  }

  public async waitForIdle(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    await this.subscriptions.get(subscription)?.waitForIdle();
  }

  public async unsubscribe(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    const worker = this.subscriptions.get(subscription);
    if (worker) {
      this.subscriptions.delete(subscription);

      await Promise.all([
        this.emit('unsubscription', worker),
        !this.subscriptions.size && this.emit('idle', undefined),
      ]);
    }
  }
}
