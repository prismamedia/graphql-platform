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
} from './change.js';
import { UniqueConstraint, type UniqueConstraintValue } from './definition.js';
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
import { NodeSubscriptionEffect } from './subscription/effect.js';
import type { NodeFilterInputValue, RawNodeSelection } from './type.js';

export * from './subscription/change.js';
export * from './subscription/dependency-graph.js';

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

export type NodeSubscriptionOptions<TValue extends NodeSelectedValue = any> = {
  where?: NodeFilterInputValue;
  selection?: RawNodeSelection<TValue>;
  id?: UniqueConstraint['name'];
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
  public readonly filter: NodeFilter | undefined;
  public readonly selection: NodeSelection<TValue>;
  public readonly id: UniqueConstraint;

  public readonly dependencies?: DependencyGraph;
  readonly #isPureSelection: boolean;

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

    this.filter = node.filterInputType.parseAndFilter(
      options?.where,
    ).normalized;

    this.selection = options?.selection
      ? node.outputType.select(options.selection)
      : node.selection;

    if (options?.id) {
      this.id = node.getUniqueConstraintByName(options.id);

      assert(
        this.selection.isSupersetOf(this.id.selection),
        `The "${this.id}" unique-constraint is not selected`,
      );

      assert(
        !this.id.isMutable(),
        `The "${this.id}" unique-constraint is mutable`,
      );
    } else {
      let id: UniqueConstraint | undefined;

      const uniqueConstraints = Array.from(node.uniqueConstraintSet).filter(
        (uniqueConstraint) => !uniqueConstraint.isMutable(),
      );

      for (const selection of this.selection.components) {
        if (
          (id = uniqueConstraints.find(
            (uniqueConstraint) =>
              uniqueConstraint.componentSet.has(selection.component) &&
              this.selection.isSupersetOf(uniqueConstraint.selection),
          ))
        ) {
          break;
        }
      }

      assert(
        id instanceof UniqueConstraint,
        `No immutable unique-constraint is selected`,
      );

      this.id = id;
    }

    this.dependencies =
      this.filter?.dependencies && this.selection.dependencies
        ? this.filter.dependencies.mergeWith(this.selection.dependencies)
        : this.filter?.dependencies || this.selection.dependencies;

    this.#isPureSelection = this.selection.isSubsetOf(node.selection);

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

  protected getRootChangeEffect(
    change: NodeChange,
  ): NodeSubscriptionEffect | undefined {
    assert.equal(change.node, this.node);

    if (change instanceof NodeDeletion) {
      const filterValue =
        !this.filter || this.filter.execute(change.oldValue, true);

      switch (filterValue) {
        case true:
        case undefined:
          return new NodeSubscriptionEffect(this, {
            deletions: [
              new NodeSubscriptionDeletion(
                this,
                this.id.parseValue(change.oldValue),
                [change.requestContext],
              ),
            ],
          });
      }
    } else if (change instanceof NodeCreation) {
      const filterValue =
        !this.filter || this.filter.execute(change.newValue, true);

      switch (filterValue) {
        case true:
          return new NodeSubscriptionEffect(
            this,
            this.#isPureSelection
              ? {
                  upserts: [
                    new NodeSubscriptionUpsert(
                      this,
                      this.id.parseValue(change.newValue),
                      this.selection.parseValue(change.newValue),
                      [change.requestContext],
                    ),
                  ],
                }
              : { incompleteUpserts: [change] },
          );

        case undefined:
          return new NodeSubscriptionEffect(this, { maybeUpserts: [change] });
      }
    } else {
      let oldFilterValue =
        !this.filter || this.filter.execute(change.oldValue, true);
      let newFilterValue =
        !this.filter || this.filter.execute(change.newValue, true);

      switch (newFilterValue) {
        case true:
          return oldFilterValue !== true ||
            this.selection.isAffectedByRootUpdate(change)
            ? new NodeSubscriptionEffect(
                this,
                this.#isPureSelection
                  ? {
                      upserts: [
                        new NodeSubscriptionUpsert(
                          this,
                          this.id.parseValue(change.newValue),
                          this.selection.parseValue(change.newValue),
                          [change.requestContext],
                        ),
                      ],
                    }
                  : { incompleteUpserts: [change] },
              )
            : undefined;

        case false:
          return oldFilterValue !== false
            ? new NodeSubscriptionEffect(this, {
                deletions: [
                  new NodeSubscriptionDeletion(
                    this,
                    this.id.parseValue(change.newValue),
                    [change.requestContext],
                  ),
                ],
              })
            : undefined;

        case undefined:
          return new NodeSubscriptionEffect(this, {
            [oldFilterValue === false ? 'maybeUpserts' : 'maybeChanges']: [
              change,
            ],
          });
      }
    }
  }

  public getNodeChangeEffect(
    changes: NodeChangeAggregation | ReadonlyArray<NodeChange> | NodeChange,
  ): NodeSubscriptionEffect | undefined {
    const aggregation =
      changes instanceof NodeChangeAggregation
        ? changes
        : new NodeChangeAggregation(
            Array.isArray(changes) ? changes : [changes],
          );

    let effect: NodeSubscriptionEffect | undefined;

    // root-changes
    const rootChanges = aggregation.changesByNode.get(this.node);
    if (rootChanges?.length) {
      rootChanges.forEach((change) => {
        const rootChangeEffect = this.getRootChangeEffect(change);
        if (rootChangeEffect) {
          effect = effect
            ? effect.mergeWith(rootChangeEffect)
            : rootChangeEffect;
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

      if (!filter.isFalse()) {
        const graphChangeEffect = new NodeSubscriptionEffect(this, {
          filter,
        });

        effect = effect
          ? effect.mergeWith(graphChangeEffect)
          : graphChangeEffect;
      }
    }

    return effect;
  }

  public async *resolveNodeChangeEffect(
    effect: NodeSubscriptionEffect,
  ): AsyncGenerator<
    NodeSubscriptionChange<TId, TValue, TRequestContext>,
    any,
    undefined
  > {
    effect?.deletions?.length && (yield* effect.deletions);
    effect?.upserts?.length && (yield* effect.upserts);

    // incomplete-upserts
    if (effect.incompleteUpserts?.length) {
      const values = await this.#api.getSomeInOrderIfExists({
        where: effect.incompleteUpserts.map(({ id }) => id),
        selection: this.selection,
      });

      for (const [index, value] of values.entries()) {
        if (value) {
          const change = effect.incompleteUpserts[index];

          yield new NodeSubscriptionUpsert(
            this,
            this.id.parseValue(value) as any,
            value as any,
            [change.requestContext],
          );
        }
      }
    }

    // maybe-upserts & maybe-changes
    if (effect.maybeUpserts?.length || effect.maybeChanges?.length) {
      const firstMaybeChangeIndex = effect.maybeUpserts?.length ?? 0;

      const changes = (
        effect.maybeUpserts?.length && effect.maybeChanges?.length
          ? [...effect.maybeUpserts, ...effect.maybeChanges]
          : effect.maybeUpserts || effect.maybeChanges
      )!;

      const values = await this.#api.getSomeInOrderIfExists({
        subset: this.filter?.inputValue,
        where: changes.map(({ id }) => id),
        selection: this.selection,
      });

      for (const [index, value] of values.entries()) {
        const change = changes[index];

        if (value) {
          yield new NodeSubscriptionUpsert(
            this,
            this.id.parseValue(value) as any,
            value as any,
            [change.requestContext],
          );
        } else if (index >= firstMaybeChangeIndex) {
          yield new NodeSubscriptionDeletion(
            this,
            this.id.parseValue(change.newValue) as any,
            [change.requestContext],
          );
        }
      }
    }

    // graph-dependencies
    if (effect.filter) {
      // deletions
      if (this.filter) {
        const cursor = this.#api.scroll({
          where: {
            AND: [this.filter.complement.inputValue, effect.filter.inputValue],
          },
          selection: this.id.selection,
        });

        for await (const id of cursor) {
          yield new NodeSubscriptionDeletion(this, id as any);
        }
      }

      // upserts
      {
        const cursor = this.#api.scroll({
          where: { AND: [this.filter?.inputValue, effect.filter.inputValue] },
          selection: this.selection,
        });

        for await (const value of cursor) {
          yield new NodeSubscriptionUpsert(
            this,
            this.id.parseValue(value) as any,
            value as any,
          );
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

    const effect = this.getNodeChangeEffect(aggregation);
    if (effect) {
      for await (const change of this.resolveNodeChangeEffect(effect)) {
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

      await this.emit('idle', undefined);
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
}
