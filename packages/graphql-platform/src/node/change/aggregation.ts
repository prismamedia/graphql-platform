import * as utils from '@prismamedia/graphql-platform-utils';
import type { Component, Node } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  filterNodeChange,
  type NodeChange,
} from '../change.js';

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
  implements Iterable<NodeChange<TRequestContext>>
{
  public readonly changesByNode: ReadonlyMap<
    Node<TRequestContext>,
    ReadonlyArray<NodeChange<TRequestContext>>
  >;

  public readonly summary: {
    readonly creations?: ReadonlySet<Node>;
    readonly deletions?: ReadonlySet<Node>;
    readonly updatesByNode?: ReadonlyMap<Node, ReadonlySet<Component>>;
    readonly changes: ReadonlySet<Node>;
  };

  public readonly size: number;

  public constructor(changes: ReadonlyArray<NodeChange<TRequestContext>>) {
    const changesByIdByNode = new Map<
      Node,
      Map<NodeChange['stringifiedId'], NodeChange>
    >();

    for (const change of changes) {
      if (!filterNodeChange(change)) {
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

        if (aggregate && filterNodeChange(aggregate)) {
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

    this.changesByNode = new Map(
      Array.from(changesByIdByNode, ([node, changesByFlattenedId]) => [
        node,
        Array.from(changesByFlattenedId.values()),
      ]),
    );

    // changes-summary
    {
      const creations = new Set<Node>();
      const deletions = new Set<Node>();
      const updatesByNode = new Map<Node, Set<Component>>();

      changesByIdByNode.forEach((changesByFlattenedId, node) => {
        const updates = new Set<Component>();

        changesByFlattenedId.forEach((change) => {
          if (change instanceof NodeCreation) {
            creations.add(node);
          } else if (change instanceof NodeDeletion) {
            deletions.add(node);
          } else {
            change.updatesByComponent.forEach((_, component) =>
              updates.add(component),
            );
          }
        });

        updates.size && updatesByNode.set(node, updates);
      });

      this.summary = {
        ...(creations.size && { creations }),
        ...(deletions.size && { deletions }),
        ...(updatesByNode.size && { updatesByNode }),
        changes: new Set([...creations, ...deletions, ...updatesByNode.keys()]),
      };
    }

    this.size = Array.from(
      this.changesByNode.values(),
      (changes) => changes.length,
    ).reduce((sum, length) => sum + length, 0);
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }

  public mergeWith(
    ...aggregations: ReadonlyArray<NodeChangeAggregation<TRequestContext>>
  ): NodeChangeAggregation<TRequestContext> | this {
    return aggregations.length
      ? new NodeChangeAggregation(
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
