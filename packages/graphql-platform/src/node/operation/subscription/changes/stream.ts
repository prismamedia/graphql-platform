import {
  AbortError,
  AsyncEventEmitter,
} from '@prismamedia/async-event-emitter';
import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import Denque from 'denque';
import assert from 'node:assert/strict';
import PQueue, { Options as PQueueOptions } from 'p-queue';
import type { Except, Promisable } from 'type-fest';
import {
  BrokerAcknowledgementKind,
  type BrokerInterface,
} from '../../../../broker-interface.js';
import type { Node, NodeValue } from '../../../../node.js';
import {
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  type NodeChange,
  type NodeUpdate,
} from '../../../change.js';
import type {
  ContextBoundNodeAPI,
  OperationContext,
} from '../../../operation.js';
import {
  FalseValue,
  NodeFilter,
  NodeSelection,
  OrOperation,
  type NodeSelectedValue,
} from '../../../statement.js';
import {
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
  type ChangesSubscriptionChange,
} from './stream/change.js';

export * from './stream/change.js';

/**
 * Group all the effect that an aggregation of changes can have on a subscription
 */
export type NodeChangesEffect<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> = {
  /**
   * Pass-through deletions, we had everything we need in the NodeChange
   */
  deletions: Array<ChangesSubscriptionDeletion<TDeletion, TRequestContext>>;

  /**
   * Pass-through upserts, we had everything we need in the NodeChange
   */
  upserts: Array<ChangesSubscriptionUpsert<TUpsert, TRequestContext>>;

  /**
   * Filtered-in, but incomplete value
   */
  incompleteUpserts: Array<
    NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
  >;

  /**
   * Not filtered, but cannot be deletion
   */
  maybeUpserts: Array<
    NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
  >;

  /**
   * Not filtered, can be anything
   */
  maybeChanges: Array<NodeUpdate<TRequestContext>>;

  /**
   * Graph changes
   */
  maybeGraphChanges?: {
    initiators: Array<TRequestContext>;
    filter: NodeFilter;
  };
};

export type ChangesSubscriptionStreamEvents<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> = {
  enqueued: ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>;
  idle: undefined;
};

export type ChangesSubscriptionStreamForEachTask<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> = (
  change: ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
  stream: ChangesSubscriptionStream<TUpsert, TDeletion, TRequestContext>,
) => Promisable<void>;

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
) => Promisable<void>;

export type ChangesSubscriptionStreamByBatchOptions =
  ChangesSubscriptionStreamForEachOptions & {
    /**
     * Optional, the maximum size of the batch
     *
     * Default: 100
     */
    batchSize?: number;
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
  extends AsyncEventEmitter<
    ChangesSubscriptionStreamEvents<TUpsert, TDeletion, TRequestContext>
  >
  implements
    AsyncIterable<
      ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
    >
{
  public readonly filter?: NodeFilter;

  public readonly onUpsertSelection: NodeSelection<TUpsert>;
  public readonly onDeletionSelection?: NodeSelection<TDeletion>;

  readonly #scrollable: boolean;
  readonly #broker: BrokerInterface;
  readonly #api: ContextBoundNodeAPI;
  readonly #ac: AbortController;

  readonly #queue: Denque<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  >;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context:
      | OperationContext<TRequestContext>
      | utils.Thunkable<TRequestContext>,
    config: Readonly<ChangesSubscriptionStreamConfig<TUpsert, TDeletion>>,
  ) {
    super({
      error: (cause) =>
        node.gp.emit(
          'error',
          new Error(
            `An error occurred in the "${node.plural}"' changes subscription`,
            { cause },
          ),
        ),
    });

    this.filter = config.filter?.normalized;

    assert(config.selection.onUpsert instanceof NodeSelection);
    this.onUpsertSelection = config.selection.onUpsert;

    if (config.selection.onDeletion) {
      assert(config.selection.onDeletion instanceof NodeSelection);
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

    this.#scrollable = node.getSubscriptionByKey('scroll').isEnabled();
    this.#broker = node.gp.broker;
    this.#api = node.createContextBoundAPI(context);
    this.#ac = new AbortController();

    this.#queue = new Denque();
  }

  @Memoize()
  public async initialize(): Promise<void> {
    this.#ac.signal.throwIfAborted();

    await this.#broker.initializeSubscription?.(this);
  }

  @Memoize()
  public async dispose(): Promise<void> {
    this.#ac.abort();

    try {
      await this.#broker.disposeSubscription?.(this);
    } finally {
      this.off();
      this.#queue.clear();
    }
  }

  public async enqueue(
    change: ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
  ): Promise<void> {
    this.#ac.signal.throwIfAborted();

    this.#queue.push(change);
    await this.emit('enqueued', change);
  }

  protected async dequeue(): Promise<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext> | undefined
  > {
    this.#ac.signal.throwIfAborted();

    let change: ChangesSubscriptionChange | undefined;

    change = this.#queue.shift();
    if (change) {
      return change;
    }

    await this.emit('idle', undefined);

    if (this.#ac.signal.aborted) {
      return;
    }

    change = this.#queue.shift();
    if (change) {
      return change;
    }

    try {
      await this.wait('enqueued', this.#ac.signal);
    } catch (error) {
      if (error instanceof AbortError) {
        return;
      }

      throw error;
    }

    return this.#queue.shift();
  }

  /**
   * Is the queue of pending-changes empty?
   */
  public isQueueEmpty(): boolean {
    return this.#queue.length === 0;
  }

  /**
   * Wait for the queue of pending-changes to be empty
   */
  public async onIdle(): Promise<void> {
    if (this.isQueueEmpty()) {
      return;
    }

    try {
      await this.wait('idle', this.#ac.signal);
    } catch (error) {
      if (error instanceof AbortError) {
        return;
      }

      throw error;
    }
  }

  public getNodeChangesEffect(
    changes:
      | NodeChangeAggregation<TRequestContext>
      | ReadonlyArray<NodeChange<TRequestContext>>
      | NodeChange<TRequestContext>,
  ): NodeChangesEffect<TUpsert, TDeletion, TRequestContext> | undefined {
    const aggregation: NodeChangeAggregation<TRequestContext> =
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

    const visitedRootNodes: NodeValue[] = [];

    // root-changes
    aggregation.changesByNode.get(this.node)?.forEach((change) => {
      if (change instanceof NodeCreation) {
        const filterValue =
          !this.filter || this.filter.execute(change.newValue, true);

        if (filterValue === true) {
          this.onUpsertSelection.isPure()
            ? effect.upserts.push(
                new ChangesSubscriptionUpsert(
                  this,
                  this.onUpsertSelection.pickValue(change.newValue as any),
                  [change.requestContext],
                ),
              )
            : effect.incompleteUpserts.push(change);
        } else if (filterValue === undefined) {
          effect.maybeUpserts.push(change);
        }

        visitedRootNodes.push(change.newValue);
      } else if (change instanceof NodeDeletion) {
        const filterValue =
          !this.filter || this.filter.execute(change.oldValue, true);

        if (filterValue !== false) {
          this.onDeletionSelection &&
            effect.deletions.push(
              new ChangesSubscriptionDeletion(
                this,
                this.onDeletionSelection.pickValue(change.oldValue as any),
                [change.requestContext],
              ),
            );
        }

        visitedRootNodes.push(change.oldValue);
      } else if (
        this.filter?.isAffectedByNodeUpdate(change) ||
        this.onUpsertSelection.isAffectedByNodeUpdate(change)
      ) {
        let newFilterValue =
          !this.filter || this.filter.execute(change.newValue, true);
        let oldFilterValue =
          !this.filter || this.filter.execute(change.oldValue, true);

        if (newFilterValue === true) {
          if (
            newFilterValue !== oldFilterValue ||
            this.onUpsertSelection.isAffectedByNodeUpdate(change)
          ) {
            this.onUpsertSelection.isPure()
              ? effect.upserts.push(
                  new ChangesSubscriptionUpsert(
                    this,
                    this.onUpsertSelection.pickValue(change.newValue as any),
                    [change.requestContext],
                  ),
                )
              : effect.incompleteUpserts.push(change);
          }
        } else if (newFilterValue === false) {
          if (newFilterValue !== oldFilterValue) {
            this.onDeletionSelection &&
              effect.deletions.push(
                new ChangesSubscriptionDeletion(
                  this,
                  this.onDeletionSelection.pickValue(change.newValue as any),
                  [change.requestContext],
                ),
              );
          }
        } else {
          effect[
            oldFilterValue === false ? 'maybeUpserts' : 'maybeChanges'
          ].push(change);
        }

        visitedRootNodes.push(change.newValue);
      } else if (this.filter?.execute(change.newValue, true) === false) {
        visitedRootNodes.push(change.newValue);
      }
    });

    // graph-changes
    {
      const initiatorSet = new Set<TRequestContext>();

      const filter = new NodeFilter(
        this.node,
        OrOperation.create(
          Array.from(aggregation, (change) => {
            const affectedFilterGraph =
              this.filter?.getAffectedGraphByNodeChange(
                change,
                visitedRootNodes,
              );

            const affectedSelectionGraph =
              this.onUpsertSelection.getAffectedGraphByNodeChange(
                change,
                visitedRootNodes,
              );

            const affectedGraph =
              affectedFilterGraph && affectedSelectionGraph
                ? affectedFilterGraph.or(affectedSelectionGraph)
                : affectedFilterGraph ?? affectedSelectionGraph;

            if (affectedGraph && !affectedGraph.isFalse()) {
              initiatorSet.add(change.requestContext);

              return affectedGraph.filter;
            }

            return FalseValue;
          }),
        ),
      );

      if (!filter.isFalse()) {
        effect.maybeGraphChanges = {
          initiators: Array.from(initiatorSet),
          filter,
        };
      }
    }

    return effect.deletions.length ||
      effect.upserts.length ||
      effect.incompleteUpserts.length ||
      effect.maybeUpserts.length ||
      effect.maybeChanges.length ||
      effect.maybeGraphChanges
      ? effect
      : undefined;
  }

  protected async *resolveNodeChangesEffect(
    effect: NodeChangesEffect<TUpsert, TDeletion, TRequestContext>,
  ): AsyncIterable<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  > {
    // pass-through changes
    yield* effect.deletions;
    yield* effect.upserts;

    // maybe-changes & incomplete-upserts & maybe-upserts
    if (
      effect.maybeChanges.length ||
      effect.incompleteUpserts.length ||
      effect.maybeUpserts.length
    ) {
      const changes = [
        ...effect.maybeChanges,
        ...effect.incompleteUpserts,
        ...effect.maybeUpserts,
      ];

      const values = await this.#api.getSomeInOrderIfExists({
        ...(this.filter &&
          (effect.maybeUpserts.length || effect.maybeChanges.length) && {
            // We don't need the filter for the "incomplete-upserts", they are already filtered-in
            subset: this.filter?.inputValue,
          }),
        where: changes.map(({ id }) => id),
        selection: this.onUpsertSelection,
      });

      for (const [index, value] of values.entries()) {
        const change = changes[index];

        if (value) {
          yield new ChangesSubscriptionUpsert(this, value as TUpsert, [
            change.requestContext,
          ]);
        } else if (
          index < effect.maybeChanges.length &&
          this.onDeletionSelection
        ) {
          yield new ChangesSubscriptionDeletion(
            this,
            this.onDeletionSelection.pickValue(change.newValue as any),
            [change.requestContext],
          );
        }
      }
    }

    // graph-changes
    if (effect.maybeGraphChanges) {
      // deletions
      if (this.filter && this.onDeletionSelection) {
        const args = {
          where: {
            AND: [
              this.filter.complement.inputValue,
              effect.maybeGraphChanges.filter.inputValue,
            ],
          },
          selection: this.onDeletionSelection,
        } as const;

        if (this.#scrollable) {
          for await (const deletion of this.#api.scroll(args)) {
            yield new ChangesSubscriptionDeletion(
              this,
              deletion as TDeletion,
              effect.maybeGraphChanges.initiators,
            );
          }
        } else {
          const deletions = await this.#api.findMany({
            ...args,
            first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
          });

          for (const deletion of deletions) {
            yield new ChangesSubscriptionDeletion(
              this,
              deletion as TDeletion,
              effect.maybeGraphChanges.initiators,
            );
          }
        }
      }

      // upserts
      {
        const args = {
          where: {
            AND: [
              this.filter?.inputValue,
              effect.maybeGraphChanges.filter.inputValue,
            ],
          },
          selection: this.onUpsertSelection,
        } as const;

        if (this.#scrollable) {
          for await (const upsert of this.#api.scroll(args)) {
            yield new ChangesSubscriptionUpsert(
              this,
              upsert as TUpsert,
              effect.maybeGraphChanges.initiators,
            );
          }
        } else {
          const upserts = await this.#api.findMany({
            ...args,
            first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
          });

          for (const upsert of upserts) {
            yield new ChangesSubscriptionUpsert(
              this,
              upsert as TUpsert,
              effect.maybeGraphChanges.initiators,
            );
          }
        }
      }
    }
  }

  public async *resolveNodeChanges(
    changesOrEffect:
      | NodeChangeAggregation<TRequestContext>
      | NodeChangesEffect<TUpsert, TDeletion, TRequestContext>,
  ): AsyncIterable<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  > {
    this.#ac.signal.throwIfAborted();

    const effect =
      changesOrEffect instanceof NodeChangeAggregation
        ? this.getNodeChangesEffect(changesOrEffect)
        : changesOrEffect;

    if (effect) {
      for await (const change of this.resolveNodeChangesEffect(effect)) {
        if (this.#ac.signal.aborted) {
          break;
        }

        yield change;
      }
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  > {
    this.#ac.signal.throwIfAborted();

    let change: ChangesSubscriptionChange | undefined;

    return {
      next: async () => {
        await change?.handleAutomaticAcknowledgement();
        await this.initialize();

        change = this.#ac.signal.aborted ? undefined : await this.dequeue();

        return change
          ? { done: false, value: change }
          : { done: true, value: undefined };
      },
      return: async () => {
        await change?.handleAutomaticAcknowledgement();
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
    this.#ac.signal.throwIfAborted();

    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const change of this) {
            change.manualAcknowledgement = true;

            await tasks.onEmpty();

            tasks.add(async () => {
              try {
                await task(change, this);

                if (!change.isAcknowledged()) {
                  await change.acknowledge(BrokerAcknowledgementKind.ACK);
                }
              } catch (error) {
                if (!change.isAcknowledged()) {
                  await change.acknowledge(BrokerAcknowledgementKind.REJECT);
                }

                throw error;
              }
            });
          }

          await tasks.onIdle();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      await this.dispose();
      tasks.clear();
    }
  }

  public async byBatch(
    task: ChangesSubscriptionStreamByBatchTask<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    {
      batchSize,
      ...queueOptions
    }: ChangesSubscriptionStreamByBatchOptions = {},
  ): Promise<void> {
    this.#ac.signal.throwIfAborted();

    const tasks = new PQueue({
      ...queueOptions,
      concurrency: queueOptions?.concurrency ?? 1,
      throwOnTimeout: queueOptions?.throwOnTimeout ?? true,
    });

    const normalizedBatchSize = Math.max(1, batchSize || 100);

    let batch: ChangesSubscriptionChange[] = [];

    const processBatch = () => {
      if (batch.length) {
        const changes = Object.freeze(batch);
        batch = [];

        tasks.add(async () => {
          try {
            await task(changes, this);

            await Promise.all(
              changes.map((change) => {
                if (!change.isAcknowledged()) {
                  return change.acknowledge(BrokerAcknowledgementKind.ACK);
                }
              }),
            );
          } catch (error) {
            await Promise.all(
              changes.map((change) => {
                if (!change.isAcknowledged()) {
                  return change.acknowledge(BrokerAcknowledgementKind.REJECT);
                }
              }),
            );

            throw error;
          }
        });
      }
    };

    const processBatchOnIdle = this.on('idle', processBatch);

    try {
      await new Promise<void>(async (resolve, reject) => {
        tasks.on('error', reject);

        try {
          for await (const change of this) {
            change.manualAcknowledgement = true;

            await tasks.onEmpty();

            if (batch.push(change) === normalizedBatchSize) {
              processBatch();
            }
          }

          processBatch();

          await tasks.onIdle();

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } finally {
      processBatchOnIdle();
      await this.dispose();
      tasks.clear();
    }
  }
}
