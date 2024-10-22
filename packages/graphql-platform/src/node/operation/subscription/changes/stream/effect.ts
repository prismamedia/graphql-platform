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
  >
  implements
    Disposable,
    AsyncIterable<
      ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
    >
{
  /**
   * Pass-through deletions, we had everything we need in the node-change
   */
  public readonly deletions: Array<
    ChangesSubscriptionDeletion<TDeletion, TRequestContext>
  > = [];

  /**
   * Pass-through upserts, we had everything we need in the node-change
   */
  public readonly upserts: Array<
    ChangesSubscriptionUpsert<TUpsert, TRequestContext>
  > = [];

  /**
   * Filtered-in, but incomplete value
   */
  public readonly incompleteUpserts: Array<NodeCreation | NodeUpdate> = [];

  /**
   * Not filtered, but cannot be deletion
   */
  public readonly maybeUpserts: Array<NodeCreation | NodeUpdate> = [];

  /**
   * Not filtered, can be anything
   */
  public readonly maybeChanges: Array<NodeUpdate> = [];

  /**
   * Graph changes
   */
  public maybeGraphChanges?: {
    readonly initiators: ReadonlySet<TRequestContext>;
    readonly filter: NodeFilter;
  };

  public constructor(
    public readonly subscription: ChangesSubscriptionStream<
      TUpsert,
      TDeletion,
      TRequestContext
    >,
    changes: NodeChangeAggregation<TRequestContext>,
  ) {
    const visitedRootNodes: NodeValue[] = [];

    // root-effect
    changes.changesByNode.get(subscription.node)?.forEach((change) => {
      if (change instanceof NodeCreation) {
        const filterValue =
          !subscription.filter ||
          subscription.filter.execute(change.newValue, true);

        if (filterValue === true) {
          subscription.onUpsertSelection.isPure()
            ? this.upserts.push(
                new ChangesSubscriptionUpsert(
                  subscription,
                  change.newValue,
                  new Set([change.requestContext]),
                ),
              )
            : this.incompleteUpserts.push(change);
        } else if (filterValue === undefined) {
          this.maybeUpserts.push(change);
        }

        visitedRootNodes.push(change.newValue);
      } else if (change instanceof NodeDeletion) {
        const filterValue =
          !subscription.filter ||
          subscription.filter.execute(change.oldValue, true);

        if (filterValue !== false && subscription.onDeletionSelection) {
          this.deletions.push(
            new ChangesSubscriptionDeletion(
              subscription,
              change.oldValue,
              new Set([change.requestContext]),
            ),
          );
        }

        visitedRootNodes.push(change.oldValue);
      } else if (
        subscription.filter?.isAffectedByRootUpdate(change) ||
        subscription.onUpsertSelection.isAffectedByRootUpdate(change)
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
            subscription.onUpsertSelection.isAffectedByRootUpdate(change)
          ) {
            subscription.onUpsertSelection.isPure()
              ? this.upserts.push(
                  new ChangesSubscriptionUpsert(
                    subscription,
                    change.newValue,
                    new Set([change.requestContext]),
                  ),
                )
              : this.incompleteUpserts.push(change);
          }
        } else if (newFilterValue === false) {
          if (
            oldFilterValue !== newFilterValue &&
            subscription.onDeletionSelection
          ) {
            this.deletions.push(
              new ChangesSubscriptionDeletion(
                subscription,
                change.newValue,
                new Set([change.requestContext]),
              ),
            );
          }
        } else if (oldFilterValue === false) {
          this.maybeUpserts.push(change);
        } else {
          this.maybeChanges.push(change);
        }

        visitedRootNodes.push(change.newValue);
      } else if (
        subscription.filter?.execute(change.newValue, true) === false
      ) {
        visitedRootNodes.push(change.newValue);
      }
    });

    // graph-effect
    {
      const initiators = new Set<TRequestContext>();
      const filter = new NodeFilter(
        subscription.node,
        OrOperation.create(
          Array.from(changes, (change) => {
            const filterGraph = subscription.filter?.getAffectedGraph(
              change,
              visitedRootNodes,
            );

            const selectionGraph =
              subscription.onUpsertSelection.getAffectedGraph(
                change,
                visitedRootNodes,
              );

            const graph =
              filterGraph && selectionGraph
                ? filterGraph.or(selectionGraph)
                : (filterGraph ?? selectionGraph);

            if (graph && !graph.isFalse()) {
              initiators.add(change.requestContext);

              return graph.filter;
            }

            return FalseValue;
          }),
        ),
      );

      if (!filter.isFalse()) {
        this.maybeGraphChanges = { initiators, filter };
      }
    }
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

  public [Symbol.dispose]() {
    this.deletions.length = 0;
    this.upserts.length = 0;
    this.incompleteUpserts.length = 0;
    this.maybeUpserts.length = 0;
    this.maybeChanges.length = 0;
    delete this.maybeGraphChanges;
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<
    ChangesSubscriptionChange<TUpsert, TDeletion, TRequestContext>
  > {
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
          yield new ChangesSubscriptionUpsert(
            this.subscription,
            value,
            new Set([change.requestContext]),
          ) as any;
        } else if (
          index < this.maybeChanges.length &&
          this.subscription.onDeletionSelection
        ) {
          yield new ChangesSubscriptionDeletion(
            this.subscription,
            change.newValue,
            new Set([change.requestContext]),
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
