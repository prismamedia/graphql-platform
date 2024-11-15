import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import Denque from 'denque';
import type { NodeChangeSubscriptionInterface } from '../../broker-interface.js';
import type {
  ChangesSubscriptionStream,
  DependentGraph,
  NodeChangeAggregation,
} from '../../node.js';
import type { InMemoryBroker } from '../in-memory.js';

export type InMemorySubscriptionEvents = {
  enqueued: DependentGraph;
  dequeued: DependentGraph;
  idle: undefined;
};

export class InMemorySubscription
  extends AsyncEventEmitter<InMemorySubscriptionEvents>
  implements NodeChangeSubscriptionInterface
{
  readonly #queue: Denque<DependentGraph>;
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
    changes: NodeChangeAggregation,
    waitUntilProcessed: boolean = this.subscription.isConsumingNodeChanges(),
  ): Promise<void> {
    const dependentGraph =
      this.subscription.dependencyGraph.createDependentGraph(changes);

    if (dependentGraph.isEmpty()) {
      return;
    }

    const processing = waitUntilProcessed
      ? new Promise<void>((resolve) => {
          const off = this.on(
            'dequeued',
            (dequeued) => {
              if (dependentGraph === dequeued) {
                off();
                resolve();
              }
            },
            this.subscription.signal,
            () => resolve(),
          );
        })
      : undefined;

    this.#queue.push(dependentGraph);
    await this.emit('enqueued', dependentGraph);

    return processing;
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    DependentGraph,
    undefined
  > {
    let dependentGraph: DependentGraph | undefined;
    do {
      while ((dependentGraph = this.#queue.peekFront())) {
        yield dependentGraph;

        this.#queue.shift();
        await this.emit('dequeued', dependentGraph);
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
