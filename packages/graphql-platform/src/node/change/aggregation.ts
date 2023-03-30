import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { NodeChange } from '../change.js';
import { NodeCreation } from './creation.js';
import { NodeUpdate } from './update.js';

function deleteNodeChange(
  changesByIdByNode: Map<Node, Map<NodeChange['stringifiedId'], NodeChange>>,
  change: NodeChange,
): void {
  let changeByFlattenedId = changesByIdByNode.get(change.node);

  if (
    changeByFlattenedId?.delete(change.stringifiedId) &&
    changeByFlattenedId.size === 0
  ) {
    changesByIdByNode.delete(change.node);
  }
}

export class NodeChangeAggregation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> implements Iterable<NodeChange<TRequestContext, TConnector, TContainer>>
{
  public readonly changesByNode: ReadonlyMap<
    Node<TRequestContext, TConnector, TContainer>,
    ReadonlyArray<NodeChange<TRequestContext, TConnector, TContainer>>
  >;

  public readonly length: number;

  public readonly nodes: ReadonlyArray<
    Node<TRequestContext, TConnector, TContainer>
  >;

  public constructor(
    public readonly gp: GraphQLPlatform<
      TRequestContext,
      TConnector,
      TContainer
    >,
    public readonly requestContext: TRequestContext,
    changes: ReadonlyArray<NodeChange>,
  ) {
    const changesByIdByNode = new Map<
      Node,
      Map<NodeChange['stringifiedId'], NodeChange>
    >();

    for (const change of changes) {
      assert.equal(
        change.requestContext,
        requestContext,
        'The changes have not occured in the same request',
      );

      const node = change.node;

      let changesById = changesByIdByNode.get(node);
      if (!changesById) {
        changesByIdByNode.set(node, (changesById = new Map()));
      }

      let previousChange = changesById.get(change.stringifiedId);
      if (!previousChange) {
        changesById.set(change.stringifiedId, change);
      } else {
        assert(
          previousChange.createdAt <= change.createdAt,
          'The aggregation has to be done in the order the changes have occured',
        );

        switch (previousChange.kind) {
          case utils.MutationType.CREATION:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Should not happen - we missed something
                changesById.set(change.stringifiedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                changesById.set(
                  change.stringifiedId,
                  new NodeCreation(
                    node,
                    change.requestContext,
                    change.newValue,
                    change.createdAt,
                    change.committedAt,
                  ),
                );
                break;
              }

              case utils.MutationType.DELETION:
                deleteNodeChange(changesByIdByNode, previousChange);
                break;
            }
            break;

          case utils.MutationType.UPDATE:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Should not happen - we missed something
                changesById.set(change.stringifiedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                if (
                  node.selection.areValuesEqual(
                    previousChange.newValue,
                    change.oldValue,
                  )
                ) {
                  const aggregate = new NodeUpdate(
                    node,
                    change.requestContext,
                    previousChange.oldValue,
                    change.newValue,
                    change.createdAt,
                    change.committedAt,
                  );

                  if (aggregate.updatesByComponent.size) {
                    changesById.set(change.stringifiedId, aggregate);
                  } else {
                    // This "update" cancels the previous "update" => no change
                    deleteNodeChange(changesByIdByNode, previousChange);
                  }
                } else {
                  // Should not happen - we missed something
                  changesById.set(change.stringifiedId, change);
                }
                break;
              }

              case utils.MutationType.DELETION:
                changesById.set(change.stringifiedId, change);
                break;
            }
            break;

          case utils.MutationType.DELETION:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                const aggregate = new NodeUpdate(
                  node,
                  change.requestContext,
                  previousChange.oldValue,
                  change.newValue,
                  change.createdAt,
                  change.committedAt,
                );

                if (aggregate.updatesByComponent.size) {
                  changesById.set(change.stringifiedId, aggregate);
                } else {
                  // This "creation" cancels the previous "deletion" => no change
                  deleteNodeChange(changesByIdByNode, previousChange);
                }
                break;
              }

              case utils.MutationType.UPDATE: {
                // Should not happen - we missed something
                changesById.set(change.stringifiedId, change);
                break;
              }

              case utils.MutationType.DELETION: {
                // Should not happen - we missed something
                changesById.set(change.stringifiedId, change);
                break;
              }
            }
            break;
        }
      }
    }

    this.changesByNode = new Map(
      Array.from(
        changesByIdByNode.entries(),
        ([node, changesByFlattenedId]) => [
          node,
          Object.freeze(Array.from(changesByFlattenedId.values())),
        ],
      ),
    );

    this.length = Array.from(this.changesByNode.values()).reduce<number>(
      (sum, changes) => sum + changes.length,
      0,
    );

    this.nodes = Object.freeze(Array.from(this.changesByNode.keys()));
  }

  *[Symbol.iterator](): IterableIterator<
    NodeChange<TRequestContext, TConnector, TContainer>
  > {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }
}
