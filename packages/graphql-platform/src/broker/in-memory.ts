import type { BoundOff } from '@prismamedia/async-event-emitter';
import assert from 'node:assert/strict';
import PQueue from 'p-queue';
import type { BrokerInterface } from '../broker-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { ChangesSubscriptionStream } from '../node.js';

export interface InMemoryBrokerOptions {
  /**
   * The maximum number of node-changes, having an effect on the subscription, that can be queued
   */
  maxQueueSize?: number;
}

export class InMemoryBroker implements BrokerInterface {
  readonly #maxQueueSize: number;
  readonly #queuesBySubscription: Map<ChangesSubscriptionStream, PQueue>;
  #nodeChangesSubscription?: BoundOff;

  public constructor(
    public readonly gp: GraphQLPlatform,
    options?: Readonly<InMemoryBrokerOptions>,
  ) {
    this.#maxQueueSize = Math.max(0, options?.maxQueueSize ?? 100);
    this.#queuesBySubscription = new Map();
  }

  protected subscribeToNodeChanges(): void {
    this.#nodeChangesSubscription ??= this.gp.on(
      'node-change-aggregation',
      (changes) =>
        Promise.all(
          Array.from(
            this.#queuesBySubscription,
            async ([subscription, queue]) => {
              const effect = subscription.getNodeChangesEffect(changes);
              if (effect) {
                await queue.onSizeLessThan(this.#maxQueueSize + 1);

                queue.add(async () => {
                  for await (const change of subscription.resolveNodeChanges(
                    effect,
                  )) {
                    subscription.enqueue(change);
                  }
                });
              }
            },
          ),
        ),
    );
  }

  protected unsubscribeFromNodeChanges(): void {
    if (this.#nodeChangesSubscription) {
      this.#nodeChangesSubscription();
      this.#nodeChangesSubscription = undefined;
    }
  }

  public initializeSubscription(subscription: ChangesSubscriptionStream): void {
    this.#queuesBySubscription.set(
      subscription,
      new PQueue({
        /**
         * We process the node-changes in the order they are received
         */
        concurrency: 1,
      }),
    );

    this.subscribeToNodeChanges();
  }

  public async disposeSubscription(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    const queue = this.#queuesBySubscription.get(subscription);

    if (
      this.#queuesBySubscription.delete(subscription) &&
      !this.#queuesBySubscription.size
    ) {
      this.unsubscribeFromNodeChanges();
    }

    queue?.clear();
  }

  public async onSubscriptionIdle(
    subscription: ChangesSubscriptionStream,
  ): Promise<void> {
    const queue = this.#queuesBySubscription.get(subscription);
    assert(queue, `The given subscription does not exist`);

    await queue.onIdle();
  }
}
