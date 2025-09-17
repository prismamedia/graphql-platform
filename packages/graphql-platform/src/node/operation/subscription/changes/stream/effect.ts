import assert from 'node:assert';
import type { NodeValue } from '../../../../../node.js';
import type { DependentGraph } from '../../../../dependency.js';
import type { NodeSelectedValue } from '../../../../statement.js';
import type { ChangesSubscriptionStream } from '../stream.js';
import {
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
  type ChangesSubscriptionChange,
} from './change.js';

/**
 * Group all the effects that some changes can have on a subscription
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
    const initiator = this.dependentGraph.changes.requestContext;
    const initiatedAt = this.dependentGraph.changes.committedAt;
    assert(initiatedAt, 'Changes must have been committed');

    // First, the deletions:
    if (this.subscription.onDeletionSelection) {
      // pass-through - we have everything we need
      yield* this.dependentGraph.deletions
        .values()
        .map(
          ({ oldValue }) =>
            new ChangesSubscriptionDeletion(
              this.subscription,
              initiator,
              initiatedAt,
              oldValue,
            ),
        );

      /**
       * articles(
       *   where: {
       *     status: PUBLISHED,
       *     tags_some: { tag: { slug: "my-tag-slug" }}
       *   }
       * ) {
       *   id
       *   tags { tag { title }}
       *   categories { category { title }}
       * }
       *
       * TagUpdate {
       *   slug: my-tag-slug -> my-new-tag-slug
       * }
       */
      if (!this.dependentGraph.deletionFilter.isFalse()) {
        for await (const deletion of this.subscription.api.scroll({
          where: this.dependentGraph.deletionFilter.inputValue,
          ...(this.subscription.cursor && { cursor: this.subscription.cursor }),
          selection: this.subscription.onDeletionSelection,
          forSubscription: {
            id: this.subscription.id,
            ifModifiedSince: initiatedAt,
          },
        })) {
          yield new ChangesSubscriptionDeletion(
            this.subscription,
            initiator,
            initiatedAt,
            deletion,
          );
        }
      }
    }

    // Then, the upserts:
    if (!this.dependentGraph.upsertFilter.isFalse()) {
      for await (const upsert of this.subscription.api.scroll({
        where: this.dependentGraph.upsertFilter.inputValue,
        ...(this.subscription.cursor && { cursor: this.subscription.cursor }),
        selection: this.subscription.onUpsertSelection,
        forSubscription: {
          id: this.subscription.id,
          ifModifiedSince: initiatedAt,
        },
      })) {
        yield new ChangesSubscriptionUpsert(
          this.subscription,
          initiator,
          initiatedAt,
          upsert,
        );
      }
    }
  }
}
