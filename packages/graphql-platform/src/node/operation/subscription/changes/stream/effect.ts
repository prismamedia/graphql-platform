import * as scalars from '@prismamedia/graphql-platform-scalars';
import type { NodeValue } from '../../../../../node.js';
import type {
  DependentGraph,
  NodeCreation,
  NodeUpdate,
} from '../../../../change.js';
import type { NodeSelectedValue } from '../../../../statement.js';
import type { ScrollSubscriptionArgs } from '../../scroll.js';
import type { ChangesSubscriptionStream } from '../stream.js';
import {
  type ChangesSubscriptionChange,
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
} from './change.js';

/**
 * Group all the effect that an aggregation of changes can have on a subscription
 */
export class ChangesSubscriptionEffect<
  TRequestContext extends object = any,
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
> implements
    AsyncIterable<
      ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>
    >
{
  public constructor(
    public readonly subscription: ChangesSubscriptionStream<
      TRequestContext,
      TUpsert,
      TDeletion
    >,
    public readonly dependentGraph: DependentGraph,
  ) {}

  public async *[Symbol.asyncIterator](): AsyncIterator<
    ChangesSubscriptionChange<TRequestContext, TUpsert, TDeletion>
  > {
    // First, the deletions:
    if (this.subscription.onDeletionSelection) {
      // pass-through - we have everything we need
      yield* this.dependentGraph.deletions
        .values()
        .map(
          ({ requestContext, oldValue }) =>
            new ChangesSubscriptionDeletion(
              this.subscription,
              requestContext,
              oldValue,
            ),
        );

      // TODO: Check that, not sure if this is correct
      if (this.subscription.filter && this.dependentGraph.filter) {
        const args = {
          where: {
            AND: [
              this.subscription.filter.complement.inputValue,
              this.dependentGraph.filter.graphFilter.inputValue,
            ],
          },
          selection: this.subscription.onDeletionSelection,
        } satisfies ScrollSubscriptionArgs;

        if (this.subscription.scrollable) {
          for await (const deletion of this.subscription.api.scroll(args)) {
            yield new ChangesSubscriptionDeletion(
              this.subscription,
              this.dependentGraph.filter.graphInitiators,
              deletion,
            );
          }
        } else {
          const deletions = await this.subscription.api.findMany({
            ...args,
            first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
          });

          for (const deletion of deletions) {
            yield new ChangesSubscriptionDeletion(
              this.subscription,
              this.dependentGraph.filter.graphInitiators,
              deletion,
            );
          }
        }
      }
    }

    // Then, the upserts:
    {
      let incompleteUpserts: ReadonlySet<NodeCreation | NodeUpdate> | undefined;

      if (this.dependentGraph.upserts.size) {
        if (this.subscription.onUpsertSelection.isPure()) {
          // pass-through - we have everything we need
          yield* this.dependentGraph.upserts
            .values()
            .map(
              ({ requestContext, newValue }) =>
                new ChangesSubscriptionUpsert(
                  this.subscription,
                  requestContext,
                  newValue,
                ),
            );
        } else {
          incompleteUpserts = this.dependentGraph.upserts;
        }
      }

      const args = {
        where: {
          AND: [
            !this.dependentGraph.graphFilter.isFalse() ||
            this.dependentGraph.upsertIfFounds.size
              ? this.subscription.filter?.inputValue
              : undefined,
            this.dependentGraph.graphFilter
              .or(
                ...this.dependentGraph.upsertIfFounds
                  .values()
                  .map(({ node, id }) => node.filterInputType.filter(id)),
              )
              .or(
                ...(incompleteUpserts
                  ?.values()
                  .map(({ node, id }) => node.filterInputType.filter(id)) ??
                  []),
              ).inputValue,
          ],
        },
        selection: this.subscription.onUpsertSelection,
      } satisfies ScrollSubscriptionArgs;

      const initiators = this.dependentGraph.graphInitiators
        .union(
          new Set(
            this.dependentGraph.upsertIfFounds
              .values()
              .map(({ requestContext }) => requestContext),
          ),
        )
        .union(
          new Set(
            incompleteUpserts
              ?.values()
              .map(({ requestContext }) => requestContext),
          ),
        );

      if (this.subscription.scrollable) {
        for await (const upsert of this.subscription.api.scroll(args)) {
          yield new ChangesSubscriptionUpsert(
            this.subscription,
            initiators,
            upsert,
          );
        }
      } else {
        const upserts = await this.subscription.api.findMany({
          ...args,
          first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
        });

        for (const upsert of upserts) {
          yield new ChangesSubscriptionUpsert(
            this.subscription,
            initiators,
            upsert,
          );
        }
      }
    }
  }
}
