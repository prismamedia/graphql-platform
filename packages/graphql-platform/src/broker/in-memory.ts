import type { EventListener } from '@prismamedia/async-event-emitter';
import assert from 'node:assert/strict';
import type { BrokerInterface } from '../broker-interface.js';
import type { GraphQLPlatform, NodeChange } from '../index.js';
import type { ChangesSubscriptionStream } from '../node.js';
import { NodeChangeAggregation } from '../node/change/aggregation.js';
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

  public async publish(changes: Iterable<NodeChange>): Promise<void> {
    const aggregation =
      changes instanceof NodeChangeAggregation
        ? changes
        : new NodeChangeAggregation(changes);

    await Promise.all(
      Array.from(this.#subscriptions.values(), (queue) =>
        queue.enqueue(aggregation),
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
