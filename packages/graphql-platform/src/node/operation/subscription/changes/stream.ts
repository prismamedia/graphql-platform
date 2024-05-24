import { AsyncEventEmitter } from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import type { Options as PQueueOptions } from 'p-queue';
import PQueue from 'p-queue';
import type { Except, Promisable } from 'type-fest';
import type {
  BrokerInterface,
  NodeChangeAggregationSubscriptionInterface,
} from '../../../../broker-interface.js';
import type { Node, NodeValue } from '../../../../node.js';
import { NodeChangeAggregation, type NodeChange } from '../../../change.js';
import type {
  ContextBoundNodeAPI,
  OperationContext,
} from '../../../operation.js';
import {
  NodeFilter,
  NodeSelection,
  type NodeSelectedValue,
} from '../../../statement.js';
import type { ChangesSubscriptionChange } from './stream/change.js';
import { ChangesSubscriptionEffect } from './stream/effect.js';

export * from './stream/change.js';
export * from './stream/effect.js';

export type ChangesSubscriptionStreamForEachTask<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> = (
  change: ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
  stream: ChangesSubscriptionStream<TUpsert, TDeletion, TRequestContext>,
) => Promisable<any>;

export type ChangesSubscriptionStreamForEachOptions = Except<
  PQueueOptions<any, any>,
  'autoStart' | 'queueClass'
>;

export type ChangesSubscriptionStreamByBatchTask<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> = (
  changes: ReadonlyArray<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  >,
  stream: ChangesSubscriptionStream<TUpsert, TDeletion, TRequestContext>,
) => Promisable<any>;

export type ChangesSubscriptionStreamByBatchOptions =
  ChangesSubscriptionStreamForEachOptions & {
    /**
     * Optional, the maximum size of the batch
     *
     * Default: 100
     */
    batchSize?: number;
  };

export type ChangesSubscriptionStreamEvents = {
  'post-effect': ChangesSubscriptionEffect;
};

export type ChangesSubscriptionStreamConfig<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
> = {
  filter?: NodeFilter;
  selection: {
    onDeletion?: NodeSelection<TDeletion>;
    onUpsert: NodeSelection<TUpsert>;
  };
};

/**
 * A subscription makes a result-set "observable"
 *
 * @see https://en.wikipedia.org/wiki/Observer_pattern
 *
 * @example <caption>Query</caption>
 * articleChanges(
 *   where: {
 *     OR: [
 *       { status: PUBLISHED },
 *       { category: { slug: "my-selected-category" }},
 *       { category: { articleCount_gt: 0 }},
 *       { tags_some: { tag: { slug: "my-selected-tag" } }},
 *       { tagCount_gte: 5 }
 *     ]
 *   }
 * ) {
 *   id
 *   title
 *   category { title }
 *   tagCount(where: { tag: { deprecated_not: true } })
 *   tags(where: { tag: { deprecated_not: true } }, orderBy: [order_ASC], first: 10) { tag { title } }
 * }
 */
export class ChangesSubscriptionStream<
    TUpsert extends NodeSelectedValue = any,
    TDeletion extends NodeValue = any,
    TRequestContext extends object = any,
  >
  extends AsyncEventEmitter<ChangesSubscriptionStreamEvents>
  implements
    AsyncIterable<
      ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
    >,
    AsyncDisposable
{
  public readonly filter?: NodeFilter;
  public readonly onUpsertSelection: NodeSelection<TUpsert>;
  public readonly onDeletionSelection?: NodeSelection<TDeletion>;

  public readonly api: ContextBoundNodeAPI;
  public readonly scrollable: boolean;

  readonly #broker: BrokerInterface;

  readonly #ac: AbortController = new AbortController();
  public readonly signal: AbortSignal = this.#ac.signal;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context: OperationContext<TRequestContext>,
    config: Readonly<ChangesSubscriptionStreamConfig<TUpsert, TDeletion>>,
  ) {
    super();

    if (config.filter) {
      assert(config.filter instanceof NodeFilter);
      assert.equal(config.filter.node, node);

      this.filter = config.filter?.normalized;
    }

    assert(config.selection.onUpsert instanceof NodeSelection);
    assert.equal(config.selection.onUpsert.node, node);
    this.onUpsertSelection = config.selection.onUpsert;

    if (config.selection.onDeletion) {
      assert(config.selection.onDeletion instanceof NodeSelection);
      assert.equal(config.selection.onDeletion.node, node);
      assert(
        config.selection.onDeletion.isPure(),
        `Expects the "onDeletion" selection to be a subset of the "${this.node}"'s selection`,
      );
      assert(
        this.onUpsertSelection.isSupersetOf(config.selection.onDeletion),
        `Expects the "onUpsert" selection to be a superset of the "onDeletion" selection`,
      );

      this.onDeletionSelection = config.selection.onDeletion;
    }

    this.api = node.createContextBoundAPI(context);
    this.scrollable = node.getSubscriptionByKey('scroll').isEnabled();

    this.#broker = node.gp.broker;
  }

  @Memoize()
  public async subscribeToNodeChanges(): Promise<NodeChangeAggregationSubscriptionInterface> {
    this.signal.throwIfAborted();

    return this.#broker.subscribe(this);
  }

  @Memoize()
  public async dispose(): Promise<void> {
    this.#ac.abort();

    await this.#broker.unsubscribe?.(this);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  public getNodeChangesEffect(
    changes:
      | NodeChangeAggregation<TRequestContext>
      | utils.Arrayable<NodeChange<TRequestContext>>,
  ): ChangesSubscriptionEffect<TUpsert, TDeletion, TRequestContext> {
    return ChangesSubscriptionEffect.createFromNodeChangeAggregation(
      this,
      changes instanceof NodeChangeAggregation
        ? changes
        : new NodeChangeAggregation(utils.resolveArrayable(changes)),
    );
  }

  @Memoize()
  protected async *changes(): AsyncIterator<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
    undefined
  > {
    const nodeChangeSubscription = await this.subscribeToNodeChanges();

    for await (const nodeChanges of nodeChangeSubscription) {
      const effect = this.getNodeChangesEffect(nodeChanges);
      if (!effect.isEmpty()) {
        for await (const change of effect) {
          yield change;

          if (this.signal.aborted) {
            return;
          }
        }

        await this.emit('post-effect', effect);
      }
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
    undefined
  > {
    return {
      next: () => this.changes().next(),
      return: async () => {
        await this.dispose();

        return { done: true, value: undefined };
      },
    };
  }

  public async forEach(
    task: ChangesSubscriptionStreamForEachTask<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    queueOptions?: ChangesSubscriptionStreamForEachOptions,
  ): Promise<void> {
    this.signal.throwIfAborted();

    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions?.concurrency ?? 1,
        throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

    this.on('post-effect', () => tasks.onIdle(), this.signal);

    await new Promise<void>(async (resolve, reject) => {
      tasks.on('error', reject);

      try {
        for await (const change of this) {
          await tasks.onSizeLessThan(tasks.concurrency);

          if (!this.signal.aborted) {
            tasks.add(() => task(change, this));
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public async byBatch(
    task: ChangesSubscriptionStreamByBatchTask<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    {
      batchSize: batchSize = 100,
      ...queueOptions
    }: ChangesSubscriptionStreamByBatchOptions = {},
  ): Promise<void> {
    this.signal.throwIfAborted();

    assert(
      typeof batchSize === 'number' && batchSize >= 1,
      `The batch-size has to be greater than or equal to 1, got ${inspect(batchSize)}`,
    );

    using tasks = Object.assign(
      new PQueue({
        ...queueOptions,
        concurrency: queueOptions?.concurrency ?? 1,
        throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
      }),
      { [Symbol.dispose]: () => tasks.clear() },
    );

    let batch: ChangesSubscriptionChange[] = [];

    const enqueueBatch = () => {
      if (batch.length) {
        const current = Object.freeze(batch);
        batch = [];
        tasks.add(() => task(current, this));
      }
    };

    this.on(
      'post-effect',
      async () => {
        enqueueBatch();
        await tasks.onIdle();
      },
      this.signal,
    );

    await new Promise<void>(async (resolve, reject) => {
      tasks.on('error', reject);

      try {
        for await (const change of this) {
          await tasks.onSizeLessThan(tasks.concurrency);

          if (!this.signal.aborted && batch.push(change) >= batchSize) {
            enqueueBatch();
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
