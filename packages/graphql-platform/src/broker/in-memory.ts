import type { EventListener } from '@prismamedia/async-event-emitter';
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

export class InMemoryBroker implements BrokerInterface {
  readonly #subscriptions = new Map<
    ChangesSubscriptionStream,
    InMemorySubscription
  >();

  public constructor(public readonly gp: GraphQLPlatform) {}

  public async publish(changes: MutationContextChanges): Promise<void> {
    await Promise.all(
      Array.from(this.#subscriptions.values(), (queue) =>
        queue.enqueue(changes),
      ),
    );
  }

  public subscribe(
    subscription: ChangesSubscriptionStream,
  ): InMemorySubscription {
    const queue = new InMemorySubscription(this, subscription);
    this.#subscriptions.set(subscription, queue);

    return queue;
  }

  public onIdle(
    subscription: ChangesSubscriptionStream,
    listener: EventListener<InMemorySubscriptionEvents, 'idle'>,
  ): void {
    this.#subscriptions.get(subscription)?.onIdle(listener);
  }

  public async waitForIdle(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    await this.#subscriptions.get(subscription)?.waitForIdle();
  }

  public unsubscribe(subscription: ChangesSubscriptionStream): void {
    this.#subscriptions.delete(subscription);
  }
}
