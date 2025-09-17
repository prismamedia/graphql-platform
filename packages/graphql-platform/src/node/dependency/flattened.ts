import type { Node } from '../../node.js';
import type { NodeChange } from '../change.js';
import { MutationContextChanges } from '../operation/mutation/context/changes.js';
import type { NodeDependency, NodeDependencyJSON } from './node.js';

export class FlattenedNodeDependencyTree {
  public constructor(
    public readonly dependencies: ReadonlyMap<Node, NodeDependency>,
  ) {}

  public dependsOn(change: NodeChange): boolean {
    return this.dependencies.get(change.node)?.dependsOn(change) ?? false;
  }

  public dependsOnChanges(changes?: MutationContextChanges): boolean {
    return changes?.size
      ? this.dependencies
          .values()
          .some((dependency) =>
            dependency.dependsOnChanges(
              changes.changesByNode.get(dependency.node),
            ),
          )
      : false;
  }

  public filterChanges<TRequestContext extends object>(
    changes: MutationContextChanges<TRequestContext>,
  ): MutationContextChanges<TRequestContext> | undefined {
    const relevantChanges = new MutationContextChanges(
      changes.requestContext,
      this.dependencies
        .values()
        .flatMap(
          (dependency) =>
            dependency.filterChanges(
              changes.changesByNode.get(dependency.node),
            ) ?? [],
        )
        .toArray(),
    );

    return relevantChanges.size ? relevantChanges : undefined;
  }

  public toJSON(): Record<Node['name'], NodeDependencyJSON> {
    return Object.fromEntries(
      this.dependencies
        .entries()
        .map(([{ name }, dependency]) => [name, dependency.toJSON()]),
    );
  }
}
