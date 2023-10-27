import {
  AbortError,
  AsyncEventEmitter,
} from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import PQueue, { Options as PQueueOptions } from 'p-queue';
import type { Except, Promisable } from 'type-fest';
import FIFO from 'yocto-queue';
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
  NodeFilter,
  NodeSelection,
  OrOperation,
  type NodeSelectedValue,
} from '../../../statement.js';
import { DependencyGraph } from '../../dependency-graph.js';
import {
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
  type ChangesSubscriptionChange,
} from './stream/change.js';

export * from './stream/change.js';

/**
 * Group all the effect that an aggregation of changes can have on a subscription
 */
type NodeChangesEffect<
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
  subscription: ChangesSubscriptionStream<TUpsert, TDeletion, TRequestContext>,
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
  subscription: ChangesSubscriptionStream<TUpsert, TDeletion, TRequestContext>,
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

  public readonly dependencies?: DependencyGraph;

  readonly #broker: BrokerInterface;
  readonly #api: ContextBoundNodeAPI;
  readonly #ac: AbortController;

  readonly #queue: FIFO<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  >;

  public constructor(
    public readonly node: Node<TRequestContext>,
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
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
        config.selection.onDeletion.isSubsetOf(this.node.selection),
        `Expects the "onDeletion" selection to be a subset of the "${this.node}"'s selection`,
      );
      assert(
        config.selection.onDeletion.isSubsetOf(this.onUpsertSelection),
        `Expects the "onDeletion" selection to be a subset of the "onUpsert" selection`,
      );

      this.onDeletionSelection = config.selection.onDeletion;
    }

    this.dependencies =
      this.filter?.dependencies && this.onUpsertSelection.dependencies
        ? this.filter.dependencies.mergeWith(
            this.onUpsertSelection.dependencies,
          )
        : this.filter?.dependencies || this.onUpsertSelection?.dependencies;

    this.#broker = node.gp.broker;
    this.#api = node.createContextBoundAPI(context);
    this.#ac = new AbortController();

    this.#queue = new FIFO();
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

  public enqueue(
    change: ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
  ): void {
    this.#ac.signal.throwIfAborted();

    this.#queue.enqueue(change);
    this.emit('enqueued', change);
  }

  protected async dequeue(): Promise<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext> | undefined
  > {
    this.#ac.signal.throwIfAborted();

    let change: ChangesSubscriptionChange | undefined;

    change = this.#queue.dequeue();
    if (change) {
      return change;
    }

    await this.emit('idle', undefined);

    if (this.#ac.signal.aborted) {
      return;
    }

    change = this.#queue.dequeue();
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

    return this.#queue.dequeue();
  }

  /**
   * Is the queue of pending-changes empty?
   */
  public isQueueEmpty(): boolean {
    return this.#queue.size === 0;
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
              this.onDeletionSelection &&
                effect.deletions.push(
                  new ChangesSubscriptionDeletion(this, change.oldValue, [
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
              this.onUpsertSelection.useGraph
                ? effect.incompleteUpserts.push(change)
                : effect.upserts.push(
                    new ChangesSubscriptionUpsert(this, change.newValue, [
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
                this.onUpsertSelection.isAffectedByRootUpdate(change)
              ) {
                this.onUpsertSelection.useGraph
                  ? effect.incompleteUpserts.push(change)
                  : effect.upserts.push(
                      new ChangesSubscriptionUpsert(this, change.newValue, [
                        change.requestContext,
                      ]),
                    );
              }
              break;

            case false:
              if (oldFilterValue !== false) {
                this.onDeletionSelection &&
                  effect.deletions.push(
                    new ChangesSubscriptionDeletion(this, change.newValue, [
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
      const initiatorSet = new Set<TRequestContext>();

      const filter = new NodeFilter(
        this.node,
        OrOperation.create(
          Array.from(aggregation.changesByNode).flatMap(([node, changes]) =>
            this.dependencies!.summary.changes.has(node)
              ? changes.map((change) => {
                  const filter = this.dependencies!.getGraphChangeFilter(
                    change,
                    rootChanges,
                  );

                  if (!filter.isFalse()) {
                    initiatorSet.add(change.requestContext);
                  }

                  return filter.filter;
                })
              : [],
          ),
        ),
      );

      !filter.isFalse() &&
        (effect.maybeGraphChanges = {
          initiators: Array.from(initiatorSet),
          filter,
        });
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
    this.#ac.signal.throwIfAborted();

    // pass-through changes
    yield* effect.deletions;
    yield* effect.upserts;

    // maybe-changes & incomplete-upserts & maybe-upserts
    if (
      effect.maybeChanges.length ||
      effect.incompleteUpserts.length ||
      effect.maybeUpserts.length
    ) {
      const nodeChanges = [
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
        where: nodeChanges.map(({ id }) => id),
        selection: this.onUpsertSelection,
      });

      for (const [index, value] of values.entries()) {
        const nodeChange = nodeChanges[index];

        if (value) {
          yield new ChangesSubscriptionUpsert(this, value, [
            nodeChange.requestContext,
          ]);
        } else if (
          index < effect.maybeChanges.length &&
          this.onDeletionSelection
        ) {
          yield new ChangesSubscriptionDeletion(this, nodeChange.newValue, [
            nodeChange.requestContext,
          ]);
        }
      }
    }

    // graph-changes
    if (effect.maybeGraphChanges) {
      // deletions
      if (this.filter && this.onDeletionSelection) {
        for await (const deletion of this.#api.scroll({
          where: {
            AND: [
              this.filter.complement.inputValue,
              effect.maybeGraphChanges.filter.inputValue,
            ],
          },
          selection: this.onDeletionSelection,
        })) {
          yield new ChangesSubscriptionDeletion(this, deletion, []);
        }
      }

      // upserts
      for await (const upsert of this.#api.scroll({
        where: {
          AND: [
            this.filter?.inputValue,
            effect.maybeGraphChanges.filter.inputValue,
          ],
        },
        selection: this.onUpsertSelection,
      })) {
        yield new ChangesSubscriptionUpsert(this, upsert, []);
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
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>,
    undefined
  > {
    this.#ac.signal.throwIfAborted();

    let change: ChangesSubscriptionChange | undefined;

    return {
      next: async () => {
        await change?.handleAutomaticAcknowledgement();

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

            if (batch.push(change) >= normalizedBatchSize) {
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
      tasks.clear();
      processBatchOnIdle();
    }
  }
}
