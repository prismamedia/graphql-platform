import {
  AbortError,
  AsyncEventEmitter,
  type BoundOff,
} from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import PQueue, { Options as PQueueOptions } from 'p-queue';
import PRetry, { Options as PRetryOptions } from 'p-retry';
import type { Except, Promisable } from 'type-fest';
import FIFO from 'yocto-queue';
import type { Node } from '../node.js';
import {
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  type NodeChange,
  type NodeUpdate,
} from './change.js';
import type { UniqueConstraint, UniqueConstraintValue } from './definition.js';
import type { ContextBoundNodeAPI, OperationContext } from './operation.js';
import {
  NodeFilter,
  NodeSelection,
  OrOperation,
  type NodeSelectedValue,
} from './statement.js';
import {
  NodeSubscriptionDeletion,
  NodeSubscriptionUpsert,
  type NodeSubscriptionChange,
} from './subscription/change.js';
import { DependencyGraph } from './subscription/dependency-graph.js';
import type { NodeFilterInputValue, RawNodeSelection } from './type.js';

export * from './subscription/change.js';
export * from './subscription/dependency-graph.js';

/**
 * Group all the effect that an aggregation of changes can have on a subscription
 */
type NodeChangesEffect = {
  /**
   * Pass-through deletions, we had everything we need in the NodeChange
   */
  deletions: Array<NodeSubscriptionDeletion>;

  /**
   * Pass-through upserts, we had everything we need in the NodeChange
   */
  upserts: Array<NodeSubscriptionUpsert>;

  /**
   * Filtered-in, but incomplete value
   */
  incompleteUpserts: Array<NodeCreation | NodeUpdate>;

  /**
   * Not filtered, but cannot be deletion
   */
  maybeUpserts: Array<NodeCreation | NodeUpdate>;

  /**
   * Not filtered, can be anything
   */
  maybeChanges: Array<NodeUpdate>;

  /**
   * Graph changes
   */
  graphChanges?: NodeFilter;
};

export type NodeSubscriptionEventDataByName<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> = {
  'change-enqueued': NodeSubscriptionChange<TId, TValue, TRequestContext>;
  'change-dequeued': NodeSubscriptionChange<TId, TValue, TRequestContext>;
  idle: undefined;
};

export type NodeSubscriptionForEachTask<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> = (
  change: NodeSubscriptionChange<TId, TValue, TRequestContext>,
  subscription: NodeSubscription<TId, TValue, TRequestContext>,
) => Promisable<void>;

export type NodeSubscriptionForEachOptions = Except<
  PQueueOptions<any, any>,
  'autoStart' | 'queueClass'
> & {
  /**
   * Optional, define a retry strategy
   *
   * Default: false / no retry
   *
   * @see https://github.com/sindresorhus/p-retry/blob/main/readme.md
   */
  retry?: PRetryOptions | number | boolean;
};

export type NodeSubscriptionForBatchTask<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> = (
  changes: ReadonlyArray<NodeSubscriptionChange<TId, TValue, TRequestContext>>,
  subscription: NodeSubscription<TId, TValue, TRequestContext>,
) => Promisable<void>;

export type NodeSubscriptionForBatchOptions = NodeSubscriptionForEachOptions & {
  /**
   * Optional, the maximum size of the batch
   *
   * Default: 100
   */
  batchSize?: number;
};

export type NodeSubscriptionOptions<TValue extends NodeSelectedValue = any> = {
  where?: NodeFilterInputValue | NodeFilter;
  selection?: RawNodeSelection<TValue>;
  uniqueConstraint?: UniqueConstraint['name'];
  signal?: AbortSignal;
};

/**
 * A subscription makes a result-set "observable"
 *
 * @see https://en.wikipedia.org/wiki/Observer_pattern
 *
 * @example <caption>Query</caption>
 * articles(
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
export class NodeSubscription<
    TId extends UniqueConstraintValue = any,
    TValue extends NodeSelectedValue & TId = any,
    TRequestContext extends object = any,
  >
  extends AsyncEventEmitter<
    NodeSubscriptionEventDataByName<TId, TValue, TRequestContext>
  >
  implements
    AsyncIterable<NodeSubscriptionChange<TId, TValue, TRequestContext>>
{
  public readonly uniqueConstraint: UniqueConstraint;
  public readonly filter?: NodeFilter;
  public readonly selection: NodeSelection<TValue>;

  public readonly dependencies?: DependencyGraph;

  readonly #api: ContextBoundNodeAPI;
  readonly #signal?: AbortSignal;
  readonly #nodeChangeListener: BoundOff;

  readonly #changes: FIFO<NodeSubscriptionChange<TId, TValue, TRequestContext>>;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
    options?: Readonly<NodeSubscriptionOptions<TValue>>,
  ) {
    super();

    // filter
    {
      const filter =
        options?.where instanceof NodeFilter
          ? options.where
          : node.filterInputType.parseAndFilter(options?.where);
      assert(!filter.isFalse());

      this.filter = filter.normalized;
    }

    this.selection = options?.selection
      ? node.outputType.select(options.selection)
      : node.selection;

    if (options?.uniqueConstraint) {
      this.uniqueConstraint = node.getUniqueConstraintByName(
        options.uniqueConstraint,
      );

      assert(
        this.selection.isSupersetOf(this.uniqueConstraint.selection),
        `The "${this.uniqueConstraint}" unique-constraint is not selected`,
      );

      assert(
        !this.uniqueConstraint.isMutable(),
        `The "${this.uniqueConstraint}" unique-constraint is mutable`,
      );
    } else {
      let uniqueConstraint: UniqueConstraint | undefined;

      const uniqueConstraints = Array.from(node.uniqueConstraintSet).filter(
        (uniqueConstraint) => !uniqueConstraint.isMutable(),
      );

      for (const selection of this.selection.components) {
        if (
          (uniqueConstraint = uniqueConstraints.find(
            (uniqueConstraint) =>
              uniqueConstraint.componentSet.has(selection.component) &&
              this.selection.isSupersetOf(uniqueConstraint.selection),
          ))
        ) {
          break;
        }
      }

      assert(uniqueConstraint, `No immutable unique-constraint is selected`);

      this.uniqueConstraint = uniqueConstraint;
    }

    this.dependencies =
      this.filter?.dependencies && this.selection.dependencies
        ? this.filter.dependencies.mergeWith(this.selection.dependencies)
        : this.filter?.dependencies || this.selection.dependencies;

    this.#api = node.createContextBoundAPI(context);

    this.#signal = options?.signal;

    this.#nodeChangeListener = node.gp.on(
      'node-change-aggregation',
      (aggregation) => this.handleNodeChanges(aggregation),
      this.#signal,
    );

    this.#changes = new FIFO();
  }

  /**
   * TODO: replace with explicit resource management using the well-known "Symbol.dispose"
   */
  public dispose(): void {
    this.#nodeChangeListener();
    this.#changes.clear();
    this.off();
  }

  public getNodeChangesEffect(
    changes: NodeChangeAggregation | ReadonlyArray<NodeChange> | NodeChange,
  ): NodeChangesEffect | undefined {
    const aggregation =
      changes instanceof NodeChangeAggregation
        ? changes
        : new NodeChangeAggregation(
            Array.isArray(changes) ? changes : [changes],
          );

    const effect: NodeChangesEffect = {
      deletions: [],
      upserts: [],
      incompleteUpserts: [],
      maybeUpserts: [],
      maybeChanges: [],
    };

    // root-changes
    const rootChanges = aggregation.changesByNode.get(this.node);
    if (rootChanges?.length) {
      rootChanges.forEach((change) => {
        if (change instanceof NodeDeletion) {
          const filterValue =
            !this.filter || this.filter.execute(change.oldValue, true);

          switch (filterValue) {
            case true:
            case undefined:
              effect.deletions.push(
                new NodeSubscriptionDeletion(this, change.oldValue, [
                  change.requestContext,
                ]),
              );
              break;
          }
        } else if (change instanceof NodeCreation) {
          const filterValue =
            !this.filter || this.filter.execute(change.newValue, true);

          switch (filterValue) {
            case true:
              this.selection.useGraph
                ? effect.incompleteUpserts.push(change)
                : effect.upserts.push(
                    new NodeSubscriptionUpsert(this, change.newValue, [
                      change.requestContext,
                    ]),
                  );
              break;

            case undefined:
              effect.maybeUpserts.push(change);
              break;
          }
        } else {
          let oldFilterValue =
            !this.filter || this.filter.execute(change.oldValue, true);
          let newFilterValue =
            !this.filter || this.filter.execute(change.newValue, true);

          switch (newFilterValue) {
            case true:
              if (
                oldFilterValue !== true ||
                this.selection.isAffectedByRootUpdate(change)
              ) {
                this.selection.useGraph
                  ? effect.incompleteUpserts.push(change)
                  : effect.upserts.push(
                      new NodeSubscriptionUpsert(this, change.newValue, [
                        change.requestContext,
                      ]),
                    );
              }
              break;

            case false:
              if (oldFilterValue !== false) {
                effect.deletions.push(
                  new NodeSubscriptionDeletion(this, change.newValue, [
                    change.requestContext,
                  ]),
                );
              }
              break;

            case undefined:
              effect[
                oldFilterValue === false ? 'maybeUpserts' : 'maybeChanges'
              ].push(change);
              break;
          }
        }
      });
    }

    // graph-changes
    if (this.dependencies?.mayBeAffectedByChanges(aggregation)) {
      const filter = new NodeFilter(
        this.node,
        OrOperation.create(
          Array.from(aggregation.changesByNode).flatMap(([node, changes]) =>
            this.dependencies!.summary.changes.has(node)
              ? changes.map(
                  (change) =>
                    this.dependencies!.getGraphChangeFilter(change, rootChanges)
                      .filter,
                )
              : [],
          ),
        ),
      );

      !filter.isFalse() && (effect.graphChanges = filter);
    }

    return effect.deletions.length ||
      effect.upserts.length ||
      effect.incompleteUpserts.length ||
      effect.maybeUpserts.length ||
      effect.maybeChanges.length ||
      effect.graphChanges
      ? effect
      : undefined;
  }

  protected async *resolveNodeChangesEffect(
    effect: NodeChangesEffect,
  ): AsyncGenerator<
    NodeSubscriptionChange<TId, TValue, TRequestContext>,
    any,
    undefined
  > {
    effect.deletions.length && (yield* effect.deletions);
    effect.upserts.length && (yield* effect.upserts);

    // incomplete-upserts & maybe-upserts & maybe-changes
    if (
      effect.incompleteUpserts.length ||
      effect.maybeUpserts.length ||
      effect.maybeChanges.length
    ) {
      const firstMaybeChangeIndex =
        effect.incompleteUpserts.length + effect.maybeUpserts.length;

      const changes = [
        ...effect.incompleteUpserts,
        ...effect.maybeUpserts,
        ...effect.maybeChanges,
      ];

      const values = await this.#api.getSomeInOrderIfExists({
        ...(this.filter &&
          (effect.maybeUpserts.length || effect.maybeChanges.length) && {
            // We don't need the filter for the "incomplete-upserts", they are already filtered-in
            subset: this.filter?.inputValue,
          }),
        where: changes.map(({ id }) => id),
        selection: this.selection,
      });

      for (const [index, value] of values.entries()) {
        const change = changes[index];

        if (value) {
          yield new NodeSubscriptionUpsert(this, value, [
            change.requestContext,
          ]);
        } else if (index >= firstMaybeChangeIndex) {
          yield new NodeSubscriptionDeletion(this, change.newValue, [
            change.requestContext,
          ]);
        }
      }
    }

    // graph-changes
    if (effect.graphChanges) {
      // deletions
      if (this.filter) {
        const cursor = this.#api.scroll({
          where: {
            AND: [
              this.filter.complement.inputValue,
              effect.graphChanges.inputValue,
            ],
          },
          selection: this.uniqueConstraint.selection,
        });

        for await (const id of cursor) {
          yield new NodeSubscriptionDeletion(this, id);
        }
      }

      // upserts
      {
        const cursor = this.#api.scroll({
          where: {
            AND: [this.filter?.inputValue, effect.graphChanges.inputValue],
          },
          selection: this.selection,
        });

        for await (const value of cursor) {
          yield new NodeSubscriptionUpsert(this, value);
        }
      }
    }
  }

  protected async enqueueChange(
    change: NodeSubscriptionChange<TId, TValue, TRequestContext>,
  ): Promise<void> {
    this.#changes.enqueue(change);
    await this.emit('change-enqueued', change);
  }

  protected async dequeueChange(): Promise<
    NodeSubscriptionChange<TId, TValue, TRequestContext> | undefined
  > {
    const change = this.#changes.dequeue();
    change && (await this.emit('change-dequeued', change));

    return change;
  }

  public async handleNodeChanges(
    changes: NodeChangeAggregation | ReadonlyArray<NodeChange> | NodeChange,
  ): Promise<void> {
    const aggregation =
      changes instanceof NodeChangeAggregation
        ? changes
        : new NodeChangeAggregation(
            Array.isArray(changes) ? changes : [changes],
          );

    const effect = this.getNodeChangesEffect(aggregation);
    if (effect) {
      for await (const change of this.resolveNodeChangesEffect(effect)) {
        if (this.#signal?.aborted) {
          break;
        }

        await this.enqueueChange(change);
      }
    }
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    NodeSubscriptionChange<TId, TValue, TRequestContext>
  > {
    let change: NodeSubscriptionChange | undefined;
    do {
      while ((change = await this.dequeueChange())) {
        if (this.#signal?.aborted) {
          break;
        }

        yield change;
      }

      if (!this.#signal?.aborted) {
        await this.emit('idle', undefined);
      }
    } while (
      !this.#signal?.aborted &&
      (await this.wait('change-enqueued', this.#signal).catch((error) => {
        if (error instanceof AbortError) {
          return undefined;
        }

        throw error;
      }))
    );
  }

  public async forEach(
    task: NodeSubscriptionForEachTask<TId, TValue, TRequestContext>,
    {
      retry: retryOptions,
      ...queueOptions
    }: NodeSubscriptionForEachOptions = {},
  ): Promise<void> {
    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const normalizedRetryOptions: PRetryOptions | false = retryOptions
      ? retryOptions === true
        ? {}
        : typeof retryOptions === 'number'
        ? { retries: retryOptions }
        : retryOptions
      : false;

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const change of this) {
            await tasks.onEmpty();

            const wrappedTask = () => task(change, this);

            tasks.add(
              normalizedRetryOptions
                ? () => PRetry(wrappedTask, normalizedRetryOptions)
                : wrappedTask,
            );
          }

          await tasks.onIdle();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      tasks.clear();
    }
  }

  public async forBatch(
    task: NodeSubscriptionForBatchTask<TId, TValue, TRequestContext>,
    {
      batchSize,
      retry: retryOptions,
      ...queueOptions
    }: NodeSubscriptionForBatchOptions = {},
  ): Promise<void> {
    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const normalizedBatchSize = Math.max(1, batchSize || 100);

    const normalizedRetryOptions: PRetryOptions | false = retryOptions
      ? retryOptions === true
        ? {}
        : typeof retryOptions === 'number'
        ? { retries: retryOptions }
        : retryOptions
      : false;

    let batch: NodeSubscriptionChange[] = [];
    const processBatch = () => {
      if (batch.length) {
        const changes = Object.freeze(batch);
        batch = [];

        const wrappedTask = () => task(changes, this);

        tasks.add(
          normalizedRetryOptions
            ? () => PRetry(wrappedTask, normalizedRetryOptions)
            : wrappedTask,
        );
      }
    };

    const processBatchOnIdle = this.on('idle', processBatch);

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const change of this) {
            await tasks.onEmpty();

            if (batch.push(change) >= normalizedBatchSize) {
              processBatch();
            }
          }

          await tasks.onIdle();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      tasks.clear();
      processBatchOnIdle();
    }
  }
}
