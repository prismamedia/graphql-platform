import assert from 'node:assert/strict';
import type { NodeCreation, NodeUpdate } from '../change.js';
import type { NodeFilter } from '../statement.js';
import type { NodeSubscription } from '../subscription.js';
import type {
  NodeSubscriptionDeletion,
  NodeSubscriptionUpsert,
} from './change.js';

export class NodeSubscriptionEffect {
  public static merge(
    first: NodeSubscriptionEffect,
    ...others: ReadonlyArray<NodeSubscriptionEffect>
  ): NodeSubscriptionEffect {
    return others.reduce((merged, other) => merged.mergeWith(other), first);
  }

  public readonly deletions?: ReadonlyArray<NodeSubscriptionDeletion>;
  public readonly upserts?: ReadonlyArray<NodeSubscriptionUpsert>;

  /**
   * Filtered-in, but incomplete value
   */
  public readonly incompleteUpserts?: ReadonlyArray<NodeCreation | NodeUpdate>;

  /**
   * Not filtered, but cannot be deletion
   */
  public readonly maybeUpserts?: ReadonlyArray<NodeCreation | NodeUpdate>;

  /**
   * Not filtered, can be anything
   */
  public readonly maybeChanges?: ReadonlyArray<NodeUpdate>;

  public readonly filter?: NodeFilter;

  public constructor(
    public readonly subscription: NodeSubscription,
    {
      deletions,
      upserts,

      incompleteUpserts,
      maybeUpserts,
      maybeChanges,

      filter,
    }: Readonly<{
      deletions?: ReadonlyArray<NodeSubscriptionDeletion>;
      upserts?: ReadonlyArray<NodeSubscriptionUpsert>;

      incompleteUpserts?: ReadonlyArray<NodeCreation | NodeUpdate>;
      maybeUpserts?: ReadonlyArray<NodeCreation | NodeUpdate>;
      maybeChanges?: ReadonlyArray<NodeUpdate>;

      filter?: NodeFilter;
    }>,
  ) {
    deletions?.length && (this.deletions = deletions);
    upserts?.length && (this.upserts = upserts);

    incompleteUpserts?.length && (this.incompleteUpserts = incompleteUpserts);
    maybeUpserts?.length && (this.maybeUpserts = maybeUpserts);
    maybeChanges?.length && (this.maybeChanges = maybeChanges);

    filter && !filter.isFalse() && (this.filter = filter);
  }

  public mergeWith(other: NodeSubscriptionEffect): NodeSubscriptionEffect {
    assert.equal(other.subscription, this.subscription);

    return new NodeSubscriptionEffect(this.subscription, {
      deletions:
        this.deletions && other.deletions
          ? [...this.deletions, ...other.deletions]
          : this.deletions || other.deletions,
      upserts:
        this.upserts && other.upserts
          ? [...this.upserts, ...other.upserts]
          : this.upserts || other.upserts,
      incompleteUpserts:
        this.incompleteUpserts && other.incompleteUpserts
          ? [...this.incompleteUpserts, ...other.incompleteUpserts]
          : this.incompleteUpserts || other.incompleteUpserts,
      maybeUpserts:
        this.maybeUpserts && other.maybeUpserts
          ? [...this.maybeUpserts, ...other.maybeUpserts]
          : this.maybeUpserts || other.maybeUpserts,
      maybeChanges:
        this.maybeChanges && other.maybeChanges
          ? [...this.maybeChanges, ...other.maybeChanges]
          : this.maybeChanges || other.maybeChanges,
      filter:
        this.filter && other.filter
          ? this.filter.or(other.filter)
          : this.filter || other.filter,
    });
  }
}
