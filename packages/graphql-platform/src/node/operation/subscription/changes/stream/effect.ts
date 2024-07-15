import * as scalars from '@prismamedia/graphql-platform-scalars';
import type { NodeValue } from '../../../../../node.js';
import {
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../../../change.js';
import {
  FalseValue,
  NodeFilter,
  OrOperation,
  type NodeSelectedValue,
} from '../../../../statement.js';
import type { ScrollSubscriptionArgs } from '../../scroll.js';
import type { ChangesSubscriptionStream } from '../stream.js';
import {
  ChangesSubscriptionChange,
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
} from './change.js';

/**
 * Group all the effect that an aggregation of changes can have on a subscription
 */
export class ChangesSubscriptionEffect<
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
  TRequestContext extends object = any,
> implements
    AsyncIterable<
      ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
    >
{
  public static createFromNodeChangeAggregation<
    TUpsert extends NodeSelectedValue,
    TDeletion extends NodeValue,
    TRequestContext extends object,
  >(
    subscription: ChangesSubscriptionStream<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    aggregation: NodeChangeAggregation<TRequestContext>,
  ): ChangesSubscriptionEffect<TUpsert, TDeletion, TRequestContext> {
    const effect: {
      deletions: Array<ChangesSubscriptionDeletion>;
      upserts: Array<ChangesSubscriptionUpsert>;
      incompleteUpserts: Array<NodeCreation | NodeUpdate>;
      maybeUpserts: Array<NodeCreation | NodeUpdate>;
      maybeChanges: Array<NodeUpdate>;
      maybeGraphChanges?: {
        initiators: Array<TRequestContext>;
        filter: NodeFilter;
      };
    } = {
      deletions: [],
      upserts: [],
      incompleteUpserts: [],
      maybeUpserts: [],
      maybeChanges: [],
    };

    if (aggregation.size) {
      const visitedRootNodes: NodeValue[] = [];

      // root-changes
      aggregation.changesByNode.get(subscription.node)?.forEach((change) => {
        if (change instanceof NodeCreation) {
          const filterValue =
            !subscription.filter ||
            subscription.filter.execute(change.newValue, true);

          if (filterValue === true) {
            subscription.onUpsertSelection.isPure()
              ? effect.upserts.push(
                  new ChangesSubscriptionUpsert(subscription, change.newValue, [
                    change.requestContext,
                  ]),
                )
              : effect.incompleteUpserts.push(change);
          } else if (filterValue === undefined) {
            effect.maybeUpserts.push(change);
          }

          visitedRootNodes.push(change.newValue);
        } else if (change instanceof NodeDeletion) {
          const filterValue =
            !subscription.filter ||
            subscription.filter.execute(change.oldValue, true);

          if (filterValue !== false) {
            subscription.onDeletionSelection &&
              effect.deletions.push(
                new ChangesSubscriptionDeletion(subscription, change.oldValue, [
                  change.requestContext,
                ]),
              );
          }

          visitedRootNodes.push(change.oldValue);
        } else if (
          subscription.filter?.isAffectedByNodeUpdate(change) ||
          subscription.onUpsertSelection.isAffectedByNodeUpdate(change)
        ) {
          let newFilterValue =
            !subscription.filter ||
            subscription.filter.execute(change.newValue, true);
          let oldFilterValue =
            !subscription.filter ||
            subscription.filter.execute(change.oldValue, true);

          if (newFilterValue === true) {
            if (
              newFilterValue !== oldFilterValue ||
              subscription.onUpsertSelection.isAffectedByNodeUpdate(change)
            ) {
              subscription.onUpsertSelection.isPure()
                ? effect.upserts.push(
                    new ChangesSubscriptionUpsert(
                      subscription,
                      change.newValue,
                      [change.requestContext],
                    ),
                  )
                : effect.incompleteUpserts.push(change);
            }
          } else if (newFilterValue === false) {
            if (newFilterValue !== oldFilterValue) {
              subscription.onDeletionSelection &&
                effect.deletions.push(
                  new ChangesSubscriptionDeletion(
                    subscription,
                    change.newValue,
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
        } else if (
          subscription.filter?.execute(change.newValue, true) === false
        ) {
          visitedRootNodes.push(change.newValue);
        }
      });

      // graph-changes
      {
        const initiatorSet = new Set<TRequestContext>();

        const filter = new NodeFilter(
          subscription.node,
          OrOperation.create(
            Array.from(aggregation, (change) => {
              const affectedFilterGraph =
                subscription.filter?.getAffectedGraphByNodeChange(
                  change,
                  visitedRootNodes,
                );

              const affectedSelectionGraph =
                subscription.onUpsertSelection.getAffectedGraphByNodeChange(
                  change,
                  visitedRootNodes,
                );

              const affectedGraph =
                affectedFilterGraph && affectedSelectionGraph
                  ? affectedFilterGraph.or(affectedSelectionGraph)
                  : (affectedFilterGraph ?? affectedSelectionGraph);

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
    }

    return new ChangesSubscriptionEffect(subscription, effect);
  }

  /**
   * Pass-through deletions, we had everything we need in the NodeChange
   */
  public readonly deletions: ReadonlyArray<
    ChangesSubscriptionDeletion<TDeletion, TRequestContext>
  >;

  /**
   * Pass-through upserts, we had everything we need in the NodeChange
   */
  public readonly upserts: ReadonlyArray<
    ChangesSubscriptionUpsert<TUpsert, TRequestContext>
  >;

  /**
   * Filtered-in, but incomplete value
   */
  public readonly incompleteUpserts: ReadonlyArray<
    NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
  >;

  /**
   * Not filtered, but cannot be deletion
   */
  public readonly maybeUpserts: ReadonlyArray<
    NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
  >;

  /**
   * Not filtered, can be anything
   */
  public readonly maybeChanges: ReadonlyArray<NodeUpdate<TRequestContext>>;

  /**
   * Graph changes
   */
  public readonly maybeGraphChanges?: {
    initiators: ReadonlyArray<TRequestContext>;
    filter: NodeFilter;
  };

  public constructor(
    public readonly subscription: ChangesSubscriptionStream<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    maybeEffect?: {
      deletions?: ReadonlyArray<
        ChangesSubscriptionDeletion<TDeletion, TRequestContext>
      >;
      upserts?: ReadonlyArray<
        ChangesSubscriptionUpsert<TUpsert, TRequestContext>
      >;
      incompleteUpserts?: ReadonlyArray<
        NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
      >;
      maybeUpserts?: ReadonlyArray<
        NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
      >;
      maybeChanges?: ReadonlyArray<NodeUpdate<TRequestContext>>;
      maybeGraphChanges?: {
        initiators: ReadonlyArray<TRequestContext>;
        filter: NodeFilter;
      };
    },
  ) {
    this.deletions = maybeEffect?.deletions ?? [];
    this.upserts = maybeEffect?.upserts ?? [];
    this.incompleteUpserts = maybeEffect?.incompleteUpserts ?? [];
    this.maybeUpserts = maybeEffect?.maybeUpserts ?? [];
    this.maybeChanges = maybeEffect?.maybeChanges ?? [];
    this.maybeGraphChanges = !maybeEffect?.maybeGraphChanges?.filter.isFalse()
      ? maybeEffect?.maybeGraphChanges
      : undefined;
  }

  public isEmpty(): boolean {
    return (
      !this.deletions.length &&
      !this.upserts.length &&
      !this.incompleteUpserts.length &&
      !this.maybeUpserts.length &&
      !this.maybeChanges.length &&
      !this.maybeGraphChanges
    );
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  > {
    if (this.isEmpty()) {
      return;
    }

    // pass-through changes
    yield* this.deletions;
    yield* this.upserts;

    // maybe-changes & incomplete-upserts & maybe-upserts
    const changes = [
      ...this.maybeChanges,
      ...this.incompleteUpserts,
      ...this.maybeUpserts,
    ];

    if (changes.length) {
      const values = await this.subscription.api.getSomeInOrderIfExists({
        ...(this.subscription.filter &&
          (this.maybeUpserts.length || this.maybeChanges.length) && {
            // We don't need the filter for the "incomplete-upserts", they are already filtered-in
            subset: this.subscription.filter.inputValue,
          }),
        where: changes.map(({ id }) => id),
        selection: this.subscription.onUpsertSelection,
      });

      for (const [index, value] of values.entries()) {
        const change = changes[index];

        if (value) {
          yield new ChangesSubscriptionUpsert(this.subscription, value, [
            change.requestContext,
          ]) as any;
        } else if (
          index < this.maybeChanges.length &&
          this.subscription.onDeletionSelection
        ) {
          yield new ChangesSubscriptionDeletion(
            this.subscription,
            change.newValue,
            [change.requestContext],
          ) as any;
        }
      }
    }

    // graph-changes
    if (this.maybeGraphChanges) {
      // deletions
      if (this.subscription.filter && this.subscription.onDeletionSelection) {
        const args = {
          where: {
            AND: [
              this.subscription.filter.complement.inputValue,
              this.maybeGraphChanges.filter.inputValue,
            ],
          },
          selection: this.subscription.onDeletionSelection,
        } satisfies ScrollSubscriptionArgs;

        if (this.subscription.scrollable) {
          for await (const deletion of this.subscription.api.scroll(args)) {
            yield new ChangesSubscriptionDeletion(
              this.subscription,
              deletion,
              this.maybeGraphChanges.initiators,
            ) as any;
          }
        } else {
          const deletions = await this.subscription.api.findMany({
            ...args,
            first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
          });

          for (const deletion of deletions) {
            yield new ChangesSubscriptionDeletion(
              this.subscription,
              deletion,
              this.maybeGraphChanges.initiators,
            ) as any;
          }
        }
      }

      // upserts
      {
        const args = {
          where: {
            AND: [
              this.subscription.filter?.inputValue,
              this.maybeGraphChanges.filter.inputValue,
            ],
          },
          selection: this.subscription.onUpsertSelection,
        } satisfies ScrollSubscriptionArgs;

        if (this.subscription.scrollable) {
          for await (const upsert of this.subscription.api.scroll(args)) {
            yield new ChangesSubscriptionUpsert(
              this.subscription,
              upsert,
              this.maybeGraphChanges.initiators,
            ) as any;
          }
        } else {
          const upserts = await this.subscription.api.findMany({
            ...args,
            first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
          });

          for (const upsert of upserts) {
            yield new ChangesSubscriptionUpsert(
              this.subscription,
              upsert,
              this.maybeGraphChanges.initiators,
            ) as any;
          }
        }
      }
    }
  }
}
