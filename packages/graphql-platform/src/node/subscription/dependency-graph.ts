import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { Node } from '../../node.js';
import {
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from '../change.js';
import {
  Edge,
  Leaf,
  UniqueReverseEdge,
  isReverseEdge,
  type Component,
  type ReverseEdge,
} from '../definition.js';
import {
  EdgeExistsFilter,
  FalseValue,
  MultipleReverseEdgeExistsFilter,
  NodeFilter,
  OrOperation,
  UniqueReverseEdgeExistsFilter,
  isComponentFilter,
  isEdgeFilter,
  isLeafFilter,
  type ComponentFilter,
  type EdgeFilter,
  type LeafFilter,
} from '../statement.js';

export class DependencyGraph {
  public static fromLeaf(leafOrFilter: Leaf | LeafFilter): DependencyGraph {
    const [leaf, filter] = isLeafFilter(leafOrFilter)
      ? [leafOrFilter.leaf, leafOrFilter]
      : [leafOrFilter, undefined];

    assert(leaf instanceof Leaf);

    return new this({ components: new Map([[leaf, new Set([filter])]]) });
  }

  public static fromEdge(
    edgeOrFilter: Edge | EdgeFilter,
    ...maybeDependencies: ReadonlyArray<DependencyGraph | undefined>
  ): DependencyGraph {
    const [edge, filter] = isEdgeFilter(edgeOrFilter)
      ? [edgeOrFilter.edge, edgeOrFilter]
      : [edgeOrFilter, undefined];

    assert(edge instanceof Edge);

    const dependencies = maybeDependencies.reduce<DependencyGraph | undefined>(
      (dependencies, maybeDependencies) =>
        dependencies && maybeDependencies
          ? dependencies.mergeWith(maybeDependencies)
          : dependencies || maybeDependencies,
      undefined,
    );

    return new this({
      components: new Map([[edge, new Set([filter])]]),
      ...(dependencies && { children: new Map([[edge, dependencies]]) }),
    });
  }

  public static fromReverseEdge(
    reverseEdge: ReverseEdge,
    ...maybeDependencies: ReadonlyArray<DependencyGraph | undefined>
  ): DependencyGraph {
    const dependencies = maybeDependencies.reduce<DependencyGraph | undefined>(
      (dependencies, maybeDependencies) =>
        dependencies && maybeDependencies
          ? dependencies.mergeWith(maybeDependencies)
          : dependencies || maybeDependencies,
      undefined,
    );

    return new this({
      children: new Map([
        [
          reverseEdge,
          this.fromEdge(reverseEdge.originalEdge).mergeWith(dependencies),
        ],
      ]),
    });
  }

  public readonly node: Node;

  public readonly components?: ReadonlyMap<
    Component,
    ReadonlySet<ComponentFilter | undefined>
  >;

  public readonly children?: ReadonlyMap<Edge | ReverseEdge, DependencyGraph>;

  /**
   * Flattened dependencies
   */
  public readonly summary: {
    readonly creations?: ReadonlySet<Node>;
    readonly deletions?: ReadonlySet<Node>;
    readonly updatesByNode?: ReadonlyMap<Node, ReadonlySet<Component>>;
    readonly changes: ReadonlySet<Node>;
  };

  public constructor({
    components,
    children,
  }: Readonly<{
    components?: DependencyGraph['components'];
    children?: DependencyGraph['children'];
  }>) {
    let node: Node | undefined;

    if (components?.size) {
      components.forEach((filters, component) => {
        assert.equal(component.node, (node ??= component.node));
        assert(
          filters instanceof Set &&
            filters.size &&
            Array.from(filters).every(
              (filter) =>
                filter === undefined ||
                (isComponentFilter(filter) && filter.component === component),
            ),
        );
      });

      this.components = components;
    }

    if (children?.size) {
      children.forEach((dependency, edgeOrReverseEdge) => {
        assert.equal(edgeOrReverseEdge.tail, (node ??= edgeOrReverseEdge.tail));
        assert.equal(dependency.node, edgeOrReverseEdge.head);
      });

      this.children = children;
    }

    assert(node);
    this.node = node;

    // dependencies-summary
    {
      const creations = new Set<Node>();
      const deletions = new Set<Node>();
      const updatesByNode = new Map<Node, Set<Component>>();

      this.children?.forEach((dependency, edgeOrReverseEdge) => {
        if (isReverseEdge(edgeOrReverseEdge)) {
          creations.add(dependency.node);
          deletions.add(dependency.node);
        }

        if (dependency.components?.size) {
          let updates = updatesByNode.get(dependency.node);
          if (!updates) {
            updatesByNode.set(dependency.node, (updates = new Set()));
          }

          dependency.components.forEach((_, component) =>
            updates!.add(component),
          );
        }

        dependency.summary.creations?.forEach((node) => creations.add(node));
        dependency.summary.deletions?.forEach((node) => deletions.add(node));
        dependency.summary.updatesByNode?.forEach((components, node) => {
          let updates = updatesByNode.get(node);
          if (!updates) {
            updatesByNode.set(node, (updates = new Set()));
          }

          components.forEach((component) => updates!.add(component));
        });
      });

      this.summary = {
        ...(creations.size && { creations }),
        ...(deletions.size && { deletions }),
        ...(updatesByNode.size && { updatesByNode }),
        changes: new Set([...creations, ...deletions, ...updatesByNode.keys()]),
      };
    }
  }

  public mergeWith(other: DependencyGraph | undefined): DependencyGraph {
    if (other) {
      assert.equal(other.node, this.node);

      return new DependencyGraph({
        components:
          this.components?.size && other.components?.size
            ? new Map(
                Array.from<
                  Component,
                  [Component, ReadonlySet<ComponentFilter | undefined>]
                >(
                  new Set([
                    ...this.components.keys(),
                    ...other.components.keys(),
                  ]),
                  (component) => {
                    const thisComponents = this.components!.get(component);
                    const otherComponents = other.components!.get(component);

                    return [
                      component,
                      thisComponents?.size && otherComponents?.size
                        ? new Set([...thisComponents, ...otherComponents])
                        : (thisComponents || otherComponents)!,
                    ];
                  },
                ),
              )
            : this.components || other.components,

        children:
          this.children?.size && other.children?.size
            ? new Map(
                Array.from<
                  Edge | ReverseEdge,
                  [Edge | ReverseEdge, DependencyGraph]
                >(
                  new Set([...this.children.keys(), ...other.children.keys()]),
                  (edgeOrReverseEdge) => {
                    const thisChildDependencies =
                      this.children!.get(edgeOrReverseEdge);
                    const otherChildDependencies =
                      other.children!.get(edgeOrReverseEdge);

                    return [
                      edgeOrReverseEdge,
                      thisChildDependencies && otherChildDependencies
                        ? thisChildDependencies.mergeWith(
                            otherChildDependencies,
                          )
                        : (thisChildDependencies || otherChildDependencies)!,
                    ];
                  },
                ),
              )
            : this.children || other.children,
      });
    }

    return this;
  }

  /**
   * Is there an intersection between the changes and these dependencies?
   */
  public mayBeAffectedByChanges(aggregation: NodeChangeAggregation): boolean {
    return (
      Array.from(this.summary.changes).some((node) =>
        aggregation.summary.changes.has(node),
      ) &&
      Boolean(
        (this.summary.creations?.size &&
          aggregation.summary.creations?.size &&
          Array.from(this.summary.creations).some((node) =>
            aggregation.summary.creations!.has(node),
          )) ||
          (this.summary.deletions?.size &&
            aggregation.summary.deletions?.size &&
            Array.from(this.summary.deletions).some((node) =>
              aggregation.summary.deletions!.has(node),
            )) ||
          (this.summary.updatesByNode?.size &&
            aggregation.summary.updatesByNode?.size &&
            Array.from(this.summary.updatesByNode).some(([node, components]) =>
              Array.from(components).some((component) =>
                aggregation.summary.updatesByNode!.get(node)?.has(component),
              ),
            )),
      )
    );
  }

  public isAffectedByUpdate(change: NodeUpdate): boolean {
    assert.equal(change.node, this.node);

    return this.components?.size
      ? Array.from(change.updatesByComponent.keys()).some((component) =>
          Array.from(this.components!.get(component) ?? []).some(
            (maybeFilter) => {
              if (maybeFilter) {
                // we care only when the result of the filter changes or when we can't tell
                const oldValue = maybeFilter.execute(change.oldValue);
                if (oldValue === undefined) {
                  return true;
                }

                const newValue = maybeFilter.execute(change.newValue);
                if (newValue === undefined) {
                  return true;
                }

                return oldValue !== newValue;
              }

              return true;
            },
          ),
        )
      : false;
  }

  @Memoize((change: NodeChange) => `${change.node.name}.${change.kind}`)
  protected getChildrenByChange(
    change: NodeChange,
  ): ReadonlyArray<[Edge | ReverseEdge, DependencyGraph]> {
    return Array.from(this.children ?? []).filter(
      ([_, dependency]) =>
        dependency.node === change.node ||
        Boolean(
          change instanceof NodeCreation
            ? dependency.summary.creations?.has(change.node)
            : change instanceof NodeDeletion
            ? dependency.summary.deletions?.has(change.node)
            : dependency.summary.updatesByNode?.has(change.node),
        ),
    );
  }

  public getGraphChangeFilter(
    change: NodeChange,
    rootChanges?: ReadonlyArray<NodeChange>,
  ): NodeFilter {
    return new NodeFilter(
      this.node,
      OrOperation.create(
        this.getChildrenByChange(change).map(
          ([edgeOrReverseEdge, dependency]) => {
            // edge
            if (edgeOrReverseEdge instanceof Edge) {
              return EdgeExistsFilter.create(
                edgeOrReverseEdge,
                new NodeFilter(
                  dependency.node,
                  OrOperation.create([
                    change.node === dependency.node &&
                    change instanceof NodeUpdate &&
                    dependency.isAffectedByUpdate(change)
                      ? dependency.node.filterInputType.filter(
                          edgeOrReverseEdge.parseValue(change.newValue),
                        ).filter
                      : FalseValue,
                    dependency.getGraphChangeFilter(change).filter,
                  ]),
                ),
              );
            }

            // reverse-edge
            if (change.node === dependency.node) {
              const rootFilter =
                change instanceof NodeDeletion
                  ? this.node.filterInputType.filter(
                      change.oldValue[edgeOrReverseEdge.originalEdge.name],
                    )
                  : change instanceof NodeCreation ||
                    dependency.isAffectedByUpdate(change)
                  ? this.node.filterInputType.filter(
                      change.newValue[edgeOrReverseEdge.originalEdge.name],
                    )
                  : undefined;

              if (rootFilter && !rootFilter.isFalse()) {
                return rootChanges?.some((change) =>
                  rootFilter.execute(
                    change instanceof NodeCreation ||
                      change instanceof NodeUpdate
                      ? change.newValue
                      : change.oldValue,
                    true,
                  ),
                )
                  ? // Already handled by a root-change
                    FalseValue
                  : rootFilter.filter;
              }
            }

            return edgeOrReverseEdge instanceof UniqueReverseEdge
              ? UniqueReverseEdgeExistsFilter.create(
                  edgeOrReverseEdge,
                  dependency.getGraphChangeFilter(change),
                )
              : MultipleReverseEdgeExistsFilter.create(
                  edgeOrReverseEdge,
                  dependency.getGraphChangeFilter(change),
                );
          },
        ),
      ),
    );
  }

  public debug(): any {
    return {
      ...(this.components?.size &&
        Object.fromEntries(
          Array.from(this.components.keys())
            .filter((component) => !this.children?.has(component as any))
            .map(({ name }) => [name, undefined]),
        )),
      ...(this.children?.size &&
        Object.fromEntries(
          Array.from(this.children, ([edgeOrReverseEdge, dependency]) => [
            edgeOrReverseEdge.name,
            dependency.debug(),
          ]),
        )),
    };
  }
}
