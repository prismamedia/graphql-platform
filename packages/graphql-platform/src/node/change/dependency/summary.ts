import type { JsonObject } from 'type-fest';
import type { Component, Node } from '../../../node.js';
import type { NodeChange } from '../../change.js';
import { NodeCreation } from '../creation.js';
import { NodeDeletion } from '../deletion.js';
import type { DependencyGraph } from '../dependency.js';
import { NodeUpdate } from '../update.js';

function append(
  current: Readonly<{
    creations: Set<Node>;
    deletions: Set<Node>;
    updatesByNode: Map<Node, Set<Component>>;
  }>,
  other: DependencyTreeSummary,
): void {
  other.creations.forEach((other) => current.creations.add(other));
  other.deletions.forEach((other) => current.deletions.add(other));
  other.componentsByNode.forEach((others, node) => {
    let currents = current.updatesByNode.get(node);
    if (!currents) {
      current.updatesByNode.set(node, (currents = new Set()));
    }

    others.forEach((other) => currents.add(other));
  });
}

export type DependencySummaryJSON = JsonObject & {
  creations?: Node['name'][];
  deletions?: Node['name'][];
  componentsByNode?: Record<Node['name'], Component['name'][]>;
  changes: Node['name'][];
};

export class DependencyTreeSummary {
  public readonly creations: ReadonlySet<Node>;
  public readonly deletions: ReadonlySet<Node>;
  public readonly componentsByNode: ReadonlyMap<Node, ReadonlySet<Component>>;
  public readonly changes: ReadonlySet<Node>;

  public constructor(dependency: DependencyGraph) {
    const creations = new Set<Node>();
    const deletions = new Set<Node>();
    const updatesByNode = new Map<Node, Set<Component>>();

    dependency.creation && creations.add(dependency.node);
    dependency.deletion && deletions.add(dependency.node);

    if (dependency.components.size) {
      let updates = updatesByNode.get(dependency.node);
      if (!updates) {
        updatesByNode.set(dependency.node, (updates = new Set()));
      }

      dependency.components.forEach((component) => updates.add(component));
    }

    dependency.graphDependencies.forEach(({ summary }) =>
      append({ creations, deletions, updatesByNode }, summary),
    );

    this.creations = creations;
    this.deletions = deletions;
    this.componentsByNode = updatesByNode;
    this.changes = new Set([
      ...creations,
      ...deletions,
      ...updatesByNode.keys(),
    ]);
  }

  public dependsOnCreation(creation: NodeCreation): boolean {
    return this.creations.has(creation.node);
  }

  public dependsOnUpdate(update: NodeUpdate): boolean {
    const components = this.componentsByNode.get(update.node);

    return components?.size && update.updatesByComponent.size
      ? !components.isDisjointFrom(update.updatesByComponent)
      : false;
  }

  public dependsOnDeletion(deletion: NodeDeletion): boolean {
    return this.deletions.has(deletion.node);
  }

  public dependsOnChange(change: NodeChange): boolean {
    return change instanceof NodeCreation
      ? this.dependsOnCreation(change)
      : change instanceof NodeUpdate
        ? this.dependsOnUpdate(change)
        : this.dependsOnDeletion(change);
  }

  public toJSON(): DependencySummaryJSON {
    return {
      ...(this.creations.size && {
        creations: Array.from(this.creations, ({ name }) => name),
      }),
      ...(this.deletions.size && {
        deletions: Array.from(this.deletions, ({ name }) => name),
      }),
      ...(this.componentsByNode.size && {
        componentsByNode: Object.fromEntries(
          Array.from(this.componentsByNode, ([node, components]) => [
            node.name,
            Array.from(components, ({ name }) => name),
          ]),
        ),
      }),
      changes: Array.from(this.changes, ({ name }) => name),
    };
  }
}
