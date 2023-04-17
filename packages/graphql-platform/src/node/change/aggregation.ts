import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Component, Node } from '../../node.js';
import { NodeCreation, NodeUpdate, type NodeChange } from '../change.js';

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
        update.createdAt,
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
        update.createdAt,
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
        creation.createdAt,
        creation.committedAt,
      ),

    [utils.MutationType.UPDATE]: invalidAggregator,
    [utils.MutationType.DELETION]: invalidAggregator,
  },
};

function filterChange(change: NodeChange): boolean {
  return (
    !(change instanceof NodeUpdate && change.isEmpty()) &&
    change.node.filterChange(change)
  );
}

export type FlatChanges = ReadonlyMap<Node, ReadonlySet<Component>>;

export class NodeChangeAggregation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> implements Iterable<NodeChange<TRequestContext, TConnector, TContainer>>
{
  public readonly requestContexts: ReadonlyArray<TRequestContext>;

  public readonly changesByNode: ReadonlyMap<
    Node<TRequestContext, TConnector, TContainer>,
    ReadonlyArray<NodeChange<TRequestContext, TConnector, TContainer>>
  >;

  /**
   * Convenient to match against NodeResultSetMutability.flatDependencies
   */
  public readonly flatChanges: FlatChanges;

  public readonly length: number;

  public constructor(changes: ReadonlyArray<NodeChange>) {
    const requestContextSet = new Set<TRequestContext>();
    const changesByIdByNode = new Map<
      Node,
      Map<NodeChange['stringifiedId'], NodeChange>
    >();

    for (const change of changes) {
      if (!filterChange(change)) {
        continue;
      }

      requestContextSet.add(change.requestContext);

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

        if (aggregate && filterChange(aggregate)) {
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

    this.requestContexts = Array.from(requestContextSet);

    this.changesByNode = new Map(
      Array.from(
        changesByIdByNode.entries(),
        ([node, changesByFlattenedId]) => [
          node,
          Array.from(changesByFlattenedId.values()),
        ],
      ),
    );

    this.flatChanges = new Map(
      Array.from(this.changesByNode.entries(), ([node, changes]) => {
        const componentSet = new Set<Component>();

        for (const change of changes) {
          if (
            change.kind === utils.MutationType.CREATION ||
            change.kind === utils.MutationType.DELETION
          ) {
            for (const component of node.componentSet) {
              componentSet.add(component);
            }

            break;
          } else {
            for (const component of change.components) {
              componentSet.add(component);
            }

            if (componentSet.size === node.componentSet.size) {
              break;
            }
          }
        }

        return [node, componentSet];
      }),
    );

    this.length = Array.from(
      this.changesByNode.values(),
      (changes) => changes.length,
    ).reduce<number>((sum, changesLength) => sum + changesLength, 0);
  }

  *[Symbol.iterator](): IterableIterator<
    NodeChange<TRequestContext, TConnector, TContainer>
  > {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }
}
