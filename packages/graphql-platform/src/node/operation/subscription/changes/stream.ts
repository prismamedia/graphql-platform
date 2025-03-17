import { AsyncEventEmitter } from '@prismamedia/async-event-emitter';
import { MMethod } from '@prismamedia/memoize';
import assert from 'node:assert';
import { randomUUID, type UUID } from 'node:crypto';
import type { Abortable } from 'node:events';
import { inspect } from 'node:util';
import PQueue, { type Options as PQueueOptions } from 'p-queue';
import type { Except, Promisable } from 'type-fest';
import type {
  BrokerInterface,
  NodeChangeSubscriptionInterface,
} from '../../../../broker-interface.js';
import type { Node, NodeValue } from '../../../../node.js';
import { DependentGraph, NodeSetDependencyGraph } from '../../../change.js';
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

export type ChangesSubscriptionStreamForEachTask<
  TRequestContext extends object = any,
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
> = (
  this: ChangesSubscriptionStream<TRequestContext, TUpsert, TDeletion>,
  change: ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>,
  signal: AbortSignal,
) => Promisable<any>;

export type ChangesSubscriptionStreamForEachOptions = Except<
  PQueueOptions<any, any>,
  'autoStart' | 'queueClass'
> &
  Abortable;

export type ChangesSubscriptionStreamByBatchTask<
  TRequestContext extends object = any,
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
> = (
  this: ChangesSubscriptionStream<TRequestContext, TUpsert, TDeletion>,
  changes: ReadonlyArray<
    ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>
  >,
  signal: AbortSignal,
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
  since: Date;
  filter?: NodeFilter;
  selection: {
    onDeletion?: NodeSelection<TDeletion>;
    onUpsert: NodeSelection<TUpsert>;
  };
  cursorSize?: number;
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
    TRequestContext extends object = any,
    TUpsert extends NodeSelectedValue = any,
    TDeletion extends NodeValue = any,
  >
  extends AsyncEventEmitter<ChangesSubscriptionStreamEvents>
  implements
    AsyncIterable<
      ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>
    >,
    AsyncDisposable
{
  public readonly id: UUID = randomUUID();

  public readonly since: Date;
  public readonly filter?: NodeFilter;
  public readonly onUpsertSelection: NodeSelection<TUpsert>;
  public readonly onDeletionSelection?: NodeSelection<TDeletion>;
  public readonly dependencyGraph: NodeSetDependencyGraph;
  public readonly cursorSize?: number;

  public readonly api: ContextBoundNodeAPI;

  readonly #broker: BrokerInterface;

  readonly #ac: AbortController;
  public readonly signal: AbortSignal;

  #consumingNodeChanges?: boolean;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context: OperationContext<TRequestContext>,
    config: Readonly<ChangesSubscriptionStreamConfig<TUpsert, TDeletion>>,
  ) {
    super();

    assert(config.since instanceof Date);
    this.since = config.since;

    if (config.filter) {
      assert(config.filter instanceof NodeFilter);
      assert.strictEqual(config.filter.node, node);

      this.filter = config.filter?.normalized;
    }

    assert(config.selection.onUpsert instanceof NodeSelection);
    assert.strictEqual(config.selection.onUpsert.node, node);
    this.onUpsertSelection = config.selection.onUpsert;

    if (config.selection.onDeletion) {
      assert(config.selection.onDeletion instanceof NodeSelection);
      assert.strictEqual(config.selection.onDeletion.node, node);
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

    this.dependencyGraph = new NodeSetDependencyGraph(
      this.node,
      this.filter,
      undefined,
      this.onUpsertSelection,
    );

    this.cursorSize = config.cursorSize;

    this.api = node.createContextBoundAPI(context);

    this.#broker = node.gp.broker;

    this.#ac = new AbortController();
    this.signal = this.#ac.signal;
  }

  public isConsumingNodeChanges(): boolean {
    return this.#consumingNodeChanges === true;
  }

  @MMethod()
  public async subscribeToNodeChanges(): Promise<NodeChangeSubscriptionInterface> {
    this.signal.throwIfAborted();

    return this.#broker.subscribe(this);
  }

  @MMethod()
  public async dispose(): Promise<void> {
    await using _nodeChangesSubscription = await this.subscribeToNodeChanges();
    this.#consumingNodeChanges = false;
    this.#ac.abort();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    return this.dispose();
  }

  @MMethod()
  protected async *changes(): AsyncIterator<
    ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>,
    undefined
  > {
    const changesSubscription = await this.subscribeToNodeChanges();
    this.#consumingNodeChanges = true;

    for await (const changes of changesSubscription) {
      const dependentGraph =
        changes instanceof DependentGraph
          ? changes
          : this.dependencyGraph.createDependentGraph(changes);

      if (!dependentGraph.isEmpty()) {
        const effect = new ChangesSubscriptionEffect(this, dependentGraph);

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
    ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>,
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
      TRequestContext,
      TUpsert,
      TDeletion
    >,
    {
      signal: externalSignal,
      ...queueOptions
    }: ChangesSubscriptionStreamForEachOptions = {},
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

    const errorController = new AbortController();
    const errorSignal = errorController.signal;

    const combinedSignal = externalSignal
      ? AbortSignal.any([externalSignal, errorSignal])
      : errorSignal;

    // This ensures that all the effects provoked by a "node-change" are processed before the next "node-change" is dequeued
    this.on('post-effect', () => tasks.onIdle(), this.signal);

    await new Promise<void>(async (resolve, reject) => {
      combinedSignal.addEventListener(
        'abort',
        () => reject(combinedSignal.reason),
        { once: true },
      );

      try {
        for await (const change of this) {
          await tasks.onSizeLessThan(tasks.concurrency);
          combinedSignal.throwIfAborted();

          tasks
            .add(
              async () => {
                try {
                  await task.call(this, change, combinedSignal);
                } catch (error) {
                  errorController.abort(error);
                }
              },
              { signal: combinedSignal },
            )
            .catch((_error) => {
              // Silent the abort
            });
        }

        await tasks.onIdle();

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public async byBatch(
    task: ChangesSubscriptionStreamByBatchTask<
      TRequestContext,
      TUpsert,
      TDeletion
    >,
    {
      batchSize: batchSize = 100,
      signal: externalSignal,
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

    const errorController = new AbortController();
    const errorSignal = errorController.signal;

    const combinedSignal = externalSignal
      ? AbortSignal.any([externalSignal, errorSignal])
      : errorSignal;

    let batch: ChangesSubscriptionChange[] = [];

    const enqueueBatch = () => {
      const changes = batch;
      batch = [];

      tasks
        .add(
          async () => {
            try {
              await task.call(this, changes, combinedSignal);
            } catch (error) {
              errorController.abort(error);
            }
          },
          { signal: combinedSignal },
        )
        .catch((_error) => {
          // Silent the abort
        });
    };

    // This ensures that all the effects provoked by a "node-change" are processed before the next "node-change" is dequeued
    this.on(
      'post-effect',
      async () => {
        if (batch.length) {
          enqueueBatch();
        }

        await tasks.onIdle();
      },
      combinedSignal,
    );

    await new Promise<void>(async (resolve, reject) => {
      combinedSignal.addEventListener(
        'abort',
        () => reject(combinedSignal.reason),
        { once: true },
      );

      try {
        for await (const change of this) {
          await tasks.onSizeLessThan(tasks.concurrency);
          combinedSignal.throwIfAborted();

          if (batch.push(change) >= batchSize) {
            enqueueBatch();
          }
        }

        await tasks.onIdle();

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
