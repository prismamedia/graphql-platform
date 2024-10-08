import type { EventListener } from '@prismamedia/async-event-emitter';
import assert from 'node:assert/strict';
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

  public async publish(nodeChanges: NodeChangeAggregation): Promise<void> {
    await Promise.all(
      Array.from(this.#subscriptions.values()).map((queue) =>
        queue.enqueue(nodeChanges),
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
    const queue = this.#subscriptions.get(subscription);
    assert(queue, `The subscription is not registered`);

    queue.onIdle(listener);
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
