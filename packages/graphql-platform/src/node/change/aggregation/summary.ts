import type { Component, Node } from '../../../node.js';
import type { NodeChangeAggregation } from '../aggregation.js';
import { NodeCreation } from '../creation.js';
import { NodeDeletion } from '../deletion.js';

export class NodeChangeAggregationSummary {
  public readonly creations?: Set<Node>;
  public readonly deletions?: Set<Node>;
  public readonly updatesByNode?: Map<Node, ReadonlySet<Component>>;

  public readonly changes: Set<Node>;

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

    creations.size && (this.creations = creations);
    deletions.size && (this.deletions = deletions);
    updatesByNode.size && (this.updatesByNode = updatesByNode);

    this.changes = new Set([
      ...creations,
      ...deletions,
      ...updatesByNode.keys(),
    ]);
  }
}
