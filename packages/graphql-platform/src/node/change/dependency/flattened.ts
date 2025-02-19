import * as utils from '@prismamedia/graphql-platform-utils';
import { MMethod } from '@prismamedia/memoize';
import type { JsonObject } from 'type-fest';
import type { Node } from '../../../node.js';
import type { NodeChange } from '../../change.js';
import type { Component } from '../../definition.js';
import { NodeCreation } from '../creation.js';
import { NodeDeletion } from '../deletion.js';
import type { DependencyGraph } from '../dependency.js';
import { NodeUpdate } from '../update.js';

function append(
  current: Map<
    Node,
    {
      [utils.MutationType.CREATION]?: true;
      [utils.MutationType.UPDATE]?: Set<Component>;
      [utils.MutationType.DELETION]?: true;
    }
  >,
  other: FlattenedDependencyGraph['byNode'],
): void {
  other.forEach((otherDependency, node) => {
    let currentDependency = current.get(node);
    if (!currentDependency) {
      current.set(node, (currentDependency = {}));
    }

    if (otherDependency[utils.MutationType.CREATION]) {
      currentDependency[utils.MutationType.CREATION] = true;
    }

    if (otherDependency[utils.MutationType.UPDATE]?.size) {
      let updates = currentDependency[utils.MutationType.UPDATE];
      if (!updates) {
        currentDependency[utils.MutationType.UPDATE] = updates = new Set();
      }

      otherDependency[utils.MutationType.UPDATE].forEach((component) =>
        updates.add(component),
      );
    }
    if (otherDependency[utils.MutationType.DELETION]) {
      currentDependency[utils.MutationType.DELETION] = true;
    }
  });
}

export type FlattenedDependencyGraphJSON = JsonObject &
  Record<
    Node['name'],
    {
      [utils.MutationType.CREATION]?: true;
      [utils.MutationType.UPDATE]?: Component['name'][];
      [utils.MutationType.DELETION]?: true;
    }
  >;

export class FlattenedDependencyGraph {
  public readonly byNode: ReadonlyMap<
    Node,
    Readonly<{
      [utils.MutationType.CREATION]?: true;
      [utils.MutationType.UPDATE]?: ReadonlySet<Component>;
      [utils.MutationType.DELETION]?: true;
    }>
  >;

  public constructor(public readonly dependency: DependencyGraph) {
    const byNode = new Map<
      Node,
      {
        [utils.MutationType.CREATION]?: true;
        [utils.MutationType.UPDATE]?: Set<Component>;
        [utils.MutationType.DELETION]?: true;
      }
    >();

    if (dependency[utils.MutationType.CREATION]) {
      let node = byNode.get(dependency.node);
      if (!node) {
        byNode.set(dependency.node, (node = {}));
      }

      node[utils.MutationType.CREATION] = true;
    }

    if (dependency[utils.MutationType.UPDATE].size) {
      let node = byNode.get(dependency.node);
      if (!node) {
        byNode.set(dependency.node, (node = {}));
      }

      let updates = node[utils.MutationType.UPDATE];
      if (!updates) {
        node[utils.MutationType.UPDATE] = updates = new Set();
      }

      dependency[utils.MutationType.UPDATE].forEach((component) =>
        updates.add(component),
      );
    }

    if (dependency[utils.MutationType.DELETION]) {
      let node = byNode.get(dependency.node);
      if (!node) {
        byNode.set(dependency.node, (node = {}));
      }

      node[utils.MutationType.DELETION] = true;
    }

    dependency.graphDependencies.forEach((other) =>
      append(byNode, other.flattened.byNode),
    );

    this.byNode = byNode;
  }

  public dependsOnCreation(creation: NodeCreation): boolean {
    return (
      this.byNode.get(creation.node)?.[utils.MutationType.CREATION] ?? false
    );
  }

  public dependsOnUpdate(update: NodeUpdate): boolean {
    const updates = this.byNode.get(update.node)?.[utils.MutationType.UPDATE];

    return updates?.size && update.updatesByComponent.size
      ? !updates.isDisjointFrom(update.updatesByComponent)
      : false;
  }

  public dependsOnDeletion(deletion: NodeDeletion): boolean {
    return (
      this.byNode.get(deletion.node)?.[utils.MutationType.DELETION] ?? false
    );
  }

  public dependsOnChange(change: NodeChange): boolean {
    return change instanceof NodeCreation
      ? this.dependsOnCreation(change)
      : change instanceof NodeUpdate
        ? this.dependsOnUpdate(change)
        : this.dependsOnDeletion(change);
  }

  @MMethod()
  public toJSON(): FlattenedDependencyGraphJSON {
    return Object.fromEntries(
      this.byNode.entries().map(([node, dependency]) => [
        node.name,
        {
          ...(dependency[utils.MutationType.CREATION] && {
            [utils.MutationType.CREATION]: true,
          }),
          ...(dependency[utils.MutationType.UPDATE]?.size && {
            [utils.MutationType.UPDATE]: Array.from(
              dependency[utils.MutationType.UPDATE],
              ({ name }) => name,
            ),
          }),
          ...(dependency[utils.MutationType.DELETION] && {
            [utils.MutationType.DELETION]: true,
          }),
        },
      ]),
    );
  }
}
