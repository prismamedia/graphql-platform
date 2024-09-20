import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { Node } from '../../node.js';
import { NodeCreation, NodeUpdate, type NodeChange } from '../change.js';
import { NodeChangeAggregationSummary } from './aggregation/summary.js';

export * from './aggregation/summary.js';

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

export class NodeChangeAggregation<TRequestContext extends object = any>
  implements Iterable<NodeChange<TRequestContext>>, Disposable
{
  public static createFromIterable<TRequestContext extends object = any>(
    changes: Iterable<NodeChange<TRequestContext>>,
  ): NodeChangeAggregation<TRequestContext> {
    const changesByIdByNode = new Map<
      Node,
      Map<NodeChange['stringifiedId'], NodeChange>
    >();

    for (const change of changes) {
      if (change instanceof NodeUpdate && change.isEmpty()) {
        continue;
      }

      let changesById = changesByIdByNode.get(change.node);
      if (!changesById) {
        changesByIdByNode.set(change.node, (changesById = new Map()));
      }

      const previousChange = changesById.get(change.stringifiedId);

      if (!previousChange) {
        changesById.set(change.stringifiedId, change);
      } else if (previousChange.at <= change.at) {
        const aggregate = aggregatorMatrix[previousChange.kind][change.kind](
          previousChange as any,
          change as any,
        );

        if (
          aggregate &&
          !(aggregate instanceof NodeUpdate && aggregate.isEmpty())
        ) {
          changesById.delete(previousChange.stringifiedId);
          changesById.set(aggregate.stringifiedId, aggregate);
        } else {
          if (
            changesById.delete(previousChange.stringifiedId) &&
            changesById.size === 0
          ) {
            changesByIdByNode.delete(previousChange.node);
          }
        }
      }
    }

    return new NodeChangeAggregation(
      new Map(
        Array.from(changesByIdByNode, ([node, changesByFlattenedId]) => [
          node,
          Array.from(changesByFlattenedId.values()),
        ]),
      ),
    );
  }

  public readonly size: number;

  public constructor(
    public readonly changesByNode: Map<
      Node<TRequestContext>,
      Array<NodeChange<TRequestContext>>
    >,
  ) {
    this.size = Array.from(
      changesByNode.values(),
      (changes) => changes.length,
    ).reduce((sum, length) => sum + length, 0);
  }

  public [Symbol.dispose](): void {
    this.changesByNode.forEach((changes) => (changes.length = 0));
    this.changesByNode.clear();
  }

  @Memoize()
  public get summary(): NodeChangeAggregationSummary {
    return new NodeChangeAggregationSummary(this);
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }

  public clone(): NodeChangeAggregation<TRequestContext> {
    return new NodeChangeAggregation(
      new Map(
        Array.from(this.changesByNode, ([node, changes]) => [
          node,
          Array.from(changes),
        ]),
      ),
    );
  }

  public mergeWith(
    ...aggregations: ReadonlyArray<NodeChangeAggregation<TRequestContext>>
  ): NodeChangeAggregation<TRequestContext> | this {
    return aggregations.length
      ? NodeChangeAggregation.createFromIterable(
          [this, ...aggregations].reduce<NodeChange[]>(
            (changes, aggregation) => {
              changes.push(...aggregation);

              return changes;
            },
            [],
          ),
        )
      : this;
  }
}
