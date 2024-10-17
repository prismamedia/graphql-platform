import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import Denque from 'denque';
import type { NodeChangeAggregationSubscriptionInterface } from '../../broker-interface.js';
import type {
  ChangesSubscriptionStream,
  NodeChangeAggregation,
} from '../../node.js';
import type { InMemoryBroker } from '../in-memory.js';

export type InMemorySubscriptionEvents = {
  enqueued: NodeChangeAggregation;
  dequeued: NodeChangeAggregation;
  idle: undefined;
};

export class InMemorySubscription
  extends AsyncEventEmitter<InMemorySubscriptionEvents>
  implements NodeChangeAggregationSubscriptionInterface
{
  readonly #queue: Denque<NodeChangeAggregation>;
  readonly #signal: AbortSignal;

  public constructor(
    public readonly broker: InMemoryBroker,
    public readonly subscription: ChangesSubscriptionStream,
  ) {
    super();

    this.#queue = new Denque();
    this.#signal = subscription.signal;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.off();
    this.#queue.clear();
    this.broker.unsubscribe(this.subscription);
  }

  public async enqueue(
    nodeChanges: NodeChangeAggregation,
    waitUntilProcessed: boolean = this.subscription.isConsumingNodeChanges(),
  ): Promise<void> {
    if (!this.subscription.isAffectedBy(nodeChanges)) {
      return;
    }

    const [processing, enqueued] = waitUntilProcessed
      ? [
          new Promise<void>((resolve) => {
            const off = this.on(
              'dequeued',
              (dequeued) => {
                if (enqueued === dequeued) {
                  off();
                  resolve();
                }
              },
              this.subscription.signal,
              () => resolve(),
            );
          }),
          nodeChanges,
        ]
      : [
          undefined,
          // As the original changes will get disposed of, we need to keep a copy of them here
          nodeChanges.clone(),
        ];

    this.#queue.push(enqueued);
    await this.emit('enqueued', enqueued);

    return processing;
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    NodeChangeAggregation,
    undefined
  > {
    let changes: NodeChangeAggregation | undefined;
    do {
      while ((changes = this.#queue.peekFront())) {
        yield changes;

        this.#queue.shift();
        await this.emit('dequeued', changes);
      }

      await this.emit('idle', undefined);
    } while (await this.wait('enqueued', this.#signal).catch(() => false));
  }

  public onIdle(
    listener: EventListener<InMemorySubscriptionEvents, 'idle'>,
  ): void {
    this.on('idle', listener, this.#signal);
  }

  public async waitForIdle(): Promise<void> {
    if (this.#queue.size()) {
      await this.wait('idle', this.#signal);
    }
  }
}
