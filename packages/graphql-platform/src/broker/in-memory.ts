import type { EventListener } from '@prismamedia/async-event-emitter';
import type { BrokerInterface } from '../broker-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type {
  ChangesSubscriptionStream,
  NodeChangeAggregation,
} from '../node.js';
import {
  InMemorySubscription,
  type InMemorySubscriptionEvents,
} from './in-memory/subscription.js';

export * from './in-memory/subscription.js';

export class InMemoryBroker implements BrokerInterface {
  readonly #subscriptions: Map<ChangesSubscriptionStream, InMemorySubscription>;

  public constructor(public readonly gp: GraphQLPlatform) {
    this.#subscriptions = new Map();
  }

  public publish(changes: NodeChangeAggregation): void {
    this.#subscriptions.forEach((queue) => queue.enqueue(changes.clone()));
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
