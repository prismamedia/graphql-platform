import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { NodeChange } from '../change.js';
import { NodeCreation } from './creation.js';
import { NodeUpdate } from './update.js';

export class NodeChangeAggregation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> implements Iterable<NodeChange<TRequestContext, TConnector>>
{
  readonly #changesByIdByNode = new Map<
    Node,
    Map<NodeChange['flattenedId'], NodeChange>
  >();

  public readonly changesByNode: ReadonlyMap<
    Node<TRequestContext, TConnector>,
    ReadonlyArray<NodeChange<TRequestContext, TConnector>>
  >;

  public readonly length: number;

  public readonly nodes: ReadonlyArray<Node<TRequestContext, TConnector>>;

  public constructor(
    changes: ReadonlyArray<NodeChange<TRequestContext, TConnector>>,
  ) {
    for (const change of changes) {
      const node = change.node;

      let changesById = this.#changesByIdByNode.get(node);
      if (!changesById) {
        this.#changesByIdByNode.set(node, (changesById = new Map()));
      }

      let previousChange = changesById.get(change.flattenedId);
      if (!previousChange) {
        changesById.set(change.flattenedId, change);
      } else {
        assert(
          previousChange.createdAt <= change.createdAt,
          'The aggregation has to be done in the order the changes have occured.',
        );

        switch (previousChange.kind) {
          case utils.MutationType.CREATION:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Should not happen - we missed something
                changesById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                changesById.set(
                  change.flattenedId,
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
                this.delete(previousChange);
                break;
            }
            break;

          case utils.MutationType.UPDATE:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Should not happen - we missed something
                changesById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                if (
                  node.areValuesEqual(previousChange.newValue, change.oldValue)
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
                    changesById.set(change.flattenedId, aggregate);
                  } else {
                    // This "update" cancels the previous "update" => no change
                    this.delete(previousChange);
                  }
                } else {
                  // Should not happen - we missed something
                  changesById.set(change.flattenedId, change);
                }
                break;
              }

              case utils.MutationType.DELETION:
                changesById.set(change.flattenedId, change);
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
                  changesById.set(change.flattenedId, aggregate);
                } else {
                  // This "creation" cancels the previous "deletion" => no change
                  this.delete(previousChange);
                }
                break;
              }

              case utils.MutationType.UPDATE: {
                // Should not happen - we missed something
                changesById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.DELETION: {
                // Should not happen - we missed something
                changesById.set(change.flattenedId, change);
                break;
              }
            }
            break;
        }
      }
    }

    this.changesByNode = new Map(
      Array.from(this.#changesByIdByNode.entries()).map(
        ([node, changesByFlattenedId]) => [
          node,
          Array.from(changesByFlattenedId.values()),
        ],
      ),
    );

    this.length = Array.from(this.changesByNode.values()).reduce<number>(
      (sum, changes) => sum + changes.length,
      0,
    );

    this.nodes = Array.from(this.changesByNode.keys());
  }

  protected delete(change: NodeChange): void {
    let changeByFlattenedId = this.#changesByIdByNode.get(change.node);

    if (
      changeByFlattenedId?.delete(change.flattenedId) &&
      changeByFlattenedId.size === 0
    ) {
      this.#changesByIdByNode.delete(change.node);
    }
  }

  *[Symbol.iterator](): IterableIterator<
    NodeChange<TRequestContext, TConnector>
  > {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }
}
