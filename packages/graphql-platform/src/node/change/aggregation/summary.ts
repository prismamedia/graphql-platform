import type { JsonObject } from 'type-fest';
import type { Component, Node } from '../../../node.js';
import type { NodeChangeAggregation } from '../aggregation.js';
import { NodeCreation } from '../creation.js';
import { NodeDeletion } from '../deletion.js';

export type NodeChangeAggregationSummaryJSON = JsonObject & {
  creations?: Node['name'][];
  deletions?: Node['name'][];
  updatesByNode?: Record<Node['name'], Component['name'][]>;
  changes: Node['name'][];
};

export class NodeChangeAggregationSummary {
  public readonly creations: ReadonlySet<Node>;
  public readonly deletions: ReadonlySet<Node>;
  public readonly updatesByNode: ReadonlyMap<Node, ReadonlySet<Component>>;
  public readonly changes: ReadonlySet<Node>;

  public constructor(aggregation: NodeChangeAggregation) {
    const creations = new Set<Node>();
    const deletions = new Set<Node>();
    const updatesByNode = new Map<Node, Set<Component>>();

    aggregation.changesByNode.forEach((changes, node) => {
      const updates = new Set<Component>();

      changes.forEach((change) => {
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

    this.creations = creations;
    this.deletions = deletions;
    this.updatesByNode = updatesByNode;
    this.changes = new Set([
      ...creations,
      ...deletions,
      ...updatesByNode.keys(),
    ]);
  }

  public toJSON(): NodeChangeAggregationSummaryJSON {
    return {
      ...(this.creations.size && {
        creations: Array.from(this.creations, ({ name }) => name),
      }),
      ...(this.deletions.size && {
        deletions: Array.from(this.deletions, ({ name }) => name),
      }),
      ...(this.updatesByNode.size && {
        updatesByNode: Object.fromEntries(
          Array.from(this.updatesByNode, ([node, components]) => [
            node.name,
            Array.from(components, ({ name }) => name),
          ]),
        ),
      }),
      changes: Array.from(this.changes, ({ name }) => name),
    };
  }
}
