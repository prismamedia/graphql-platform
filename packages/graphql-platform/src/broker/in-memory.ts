import assert from 'node:assert/strict';
import PQueue from 'p-queue';
import type { BrokerInterface } from '../broker-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type {
  ChangesSubscriptionStream,
  NodeChangeAggregation,
} from '../node.js';

export interface InMemoryBrokerOptions {
  /**
   * The maximum number of node-changes, having an effect on the subscription, that can be queued
   */
  maxQueueSize?: number;
}

export class InMemoryBroker implements BrokerInterface {
  readonly #maxQueueSize: number;
  readonly #queuesBySubscription: Map<ChangesSubscriptionStream, PQueue>;

  public constructor(
    public readonly gp: GraphQLPlatform,
    options?: Readonly<InMemoryBrokerOptions>,
  ) {
    this.#maxQueueSize = Math.max(0, options?.maxQueueSize ?? 10);
    this.#queuesBySubscription = new Map();
  }

  public async onLocalNodeChanges(
    changes: NodeChangeAggregation,
  ): Promise<void> {
    await Promise.all(
      Array.from(this.#queuesBySubscription, async ([subscription, queue]) => {
        const effect = subscription.getNodeChangesEffect(changes);
        if (effect) {
          await queue.onSizeLessThan(this.#maxQueueSize + 1);

          queue.add(async () => {
            for await (const change of subscription.resolveNodeChanges(
              effect,
            )) {
              await subscription.enqueue(change);
            }
          });
        }
      }),
    );
  }

  public initializeSubscription(subscription: ChangesSubscriptionStream): void {
    this.#queuesBySubscription.set(
      subscription,
      new PQueue({
        /**
         * We process the node-changes in the order they are received
         */
        concurrency: 1,
      }).on('error', (error) => subscription.emit('error', error)),
    );
  }

  public async disposeSubscription(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    this.#queuesBySubscription.delete(subscription);
  }

  public async onSubscriptionIdle(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    const queue = this.#queuesBySubscription.get(subscription);
    assert(queue, `The given subscription is not running`);

    await queue.onIdle();
  }
}
