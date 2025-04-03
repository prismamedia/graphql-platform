import assert from 'node:assert';
import type { NodeValue } from '../../../../../node.js';
import type {
  DependentGraph,
  NodeCreation,
  NodeUpdate,
} from '../../../../change.js';
import type { NodeSelectedValue } from '../../../../statement.js';
import type { ChangesSubscriptionStream } from '../stream.js';
import {
  type ChangesSubscriptionChange,
  ChangesSubscriptionDeletion,
  ChangesSubscriptionUpsert,
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
    const committedAt = this.dependentGraph.changes.committedAt;
    assert(committedAt, 'Changes must be committed');

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
      if (this.subscription.filter && this.dependentGraph.filter) {
        for await (const deletion of this.subscription.api.scroll({
          where: {
            AND: [
              this.subscription.filter.complement.inputValue,
              this.dependentGraph.filter.graphFilter.inputValue,
            ],
          },
          selection: this.subscription.onDeletionSelection,
          ...(this.subscription.cursorSize && {
            chunkSize: this.subscription.cursorSize * 2,
          }),
          ...(this.subscription.useCache && {
            forSubscription: {
              id: this.subscription.id,
              ifModifiedSince: committedAt,
            },
          }),
        })) {
          yield new ChangesSubscriptionDeletion(
            this.subscription,
            initiator,
            deletion,
          );
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
              ({ newValue }) =>
                new ChangesSubscriptionUpsert(
                  this.subscription,
                  initiator,
                  newValue,
                ),
            );
        } else {
          incompleteUpserts = this.dependentGraph.upserts;
        }
      }

      for await (const upsert of this.subscription.api.scroll({
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
        ...(this.subscription.cursorSize && {
          chunkSize: this.subscription.cursorSize,
        }),
        ...(this.subscription.useCache && {
          forSubscription: {
            id: this.subscription.id,
            ifModifiedSince: committedAt,
          },
        }),
      })) {
        yield new ChangesSubscriptionUpsert(
          this.subscription,
          initiator,
          upsert,
        );
      }
    }
  }
}
