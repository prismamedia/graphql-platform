import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { Node } from '../../../node.js';
import { isActualNodeChange, type NodeChange } from '../../change.js';
import type { NodeChangeAggregation } from '../aggregation.js';
import { NodeCreation } from '../creation.js';
import { NodeDeletion } from '../deletion.js';
import { NodeUpdate } from '../update.js';

type NodeChangeAggregatorMatrix = {
  [TPreviousChangeKind in utils.MutationType]: {
    [TChangeKind in utils.MutationType]: (
      previousChange: Extract<NodeChange, { kind: TPreviousChangeKind }>,
      change: Extract<NodeChange, { kind: TChangeKind }>,
    ) => NodeChange | void;
  };
};

/**
 * A case that should not happen, we missed something.
 * We could throw an error, but let's keep the new change instead.
 */
const invalidAggregator = (_previousChange: NodeChange, change: NodeChange) =>
  change;

const aggregatorMatrix: NodeChangeAggregatorMatrix = {
  [utils.MutationType.CREATION]: {
    [utils.MutationType.CREATION]: invalidAggregator,

    [utils.MutationType.UPDATE]: (_previousCreation, update) =>
      new NodeCreation(
        update.node,
        update.requestContext,
        update.newValue,
        update.executedAt,
        update.committedAt,
      ),

    [utils.MutationType.DELETION]: (_previousCreation, _deletion) =>
      // This "deletion" cancels the previous "creation" => no change
      undefined,
  },
  [utils.MutationType.UPDATE]: {
    [utils.MutationType.CREATION]: invalidAggregator,

    [utils.MutationType.UPDATE]: (previousUpdate, update) =>
      new NodeUpdate(
        update.node,
        update.requestContext,
        previousUpdate.oldValue,
        update.newValue,
        update.executedAt,
        update.committedAt,
      ),

    [utils.MutationType.DELETION]: (_previousUpdate, deletion) => deletion,
  },
  [utils.MutationType.DELETION]: {
    [utils.MutationType.CREATION]: (previousDeletion, creation) =>
      new NodeUpdate(
        creation.node,
        creation.requestContext,
        previousDeletion.oldValue,
        creation.newValue,
        creation.executedAt,
        creation.committedAt,
      ),

    [utils.MutationType.UPDATE]: invalidAggregator,
    [utils.MutationType.DELETION]: invalidAggregator,
  },
};

export class NodeChangeAggregationByNode<TRequestContext extends object = any>
  implements Iterable<NodeChange<TRequestContext>>, Disposable
{
  public readonly [utils.MutationType.CREATION] = new Map<
    NodeChange['stringifiedId'],
    NodeCreation<TRequestContext>
  >();

  public readonly [utils.MutationType.UPDATE] = new Map<
    NodeChange['stringifiedId'],
    NodeUpdate<TRequestContext>
  >();

  public readonly [utils.MutationType.DELETION] = new Map<
    NodeChange['stringifiedId'],
    NodeDeletion<TRequestContext>
  >();

  public constructor(
    public readonly parent: NodeChangeAggregation<TRequestContext>,
    public readonly node: Node,
  ) {}

  public add(change: NodeChange<TRequestContext>): void {
    assert.equal(change.node, this.node);
    if (!isActualNodeChange(change)) {
      return;
    }

    const previousChange =
      this[utils.MutationType.CREATION].get(change.stringifiedId) ??
      this[utils.MutationType.UPDATE].get(change.stringifiedId) ??
      this[utils.MutationType.DELETION].get(change.stringifiedId);

    if (!previousChange) {
      if (
        this.parent.maxSize !== undefined &&
        this.parent.maxSize <= this.size
      ) {
        if (this.parent.onMaxSizeReached === 'error') {
          throw new Error(
            `The maximum number of changes, ${this.parent.maxSize}, has been reached`,
          );
        }

        return;
      }

      this[change.kind].set(change.stringifiedId, change as any);
    } else if (previousChange.at <= change.at) {
      this[previousChange.kind].delete(previousChange.stringifiedId);

      const aggregate = aggregatorMatrix[previousChange.kind][change.kind](
        previousChange as any,
        change as any,
      );

      if (aggregate && isActualNodeChange(aggregate)) {
        this[aggregate.kind].set(aggregate.stringifiedId, aggregate as any);
      }
    }
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const type of utils.mutationTypes) {
      yield* this[type].values();
    }
  }

  public [Symbol.dispose](): void {
    utils.mutationTypes.forEach((type) => this[type].clear());
  }

  public commit(at: Date = new Date()): void {
    utils.mutationTypes.forEach((type) =>
      this[type].forEach((change) => (change.committedAt = at)),
    );
  }

  public get size(): number {
    return utils.mutationTypes.reduce((sum, type) => sum + this[type].size, 0);
  }

  public isEmpty(): boolean {
    return utils.mutationTypes.every((type) => this[type].size === 0);
  }
}
