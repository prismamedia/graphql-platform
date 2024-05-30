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

  public enqueue(changes: NodeChangeAggregation): void {
    this.#queue.push(changes);
    this.emit('enqueued', changes);
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
        this.emit('dequeued', changes);
      }

      this.emit('idle', undefined);
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

  public async [Symbol.asyncDispose](): Promise<void> {
    this.broker.unsubscribe(this.subscription);
  }
}
