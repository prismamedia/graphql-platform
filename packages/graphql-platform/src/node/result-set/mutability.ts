import assert from 'node:assert/strict';
import type { Node } from '../../node.js';
import {
  NodeChange,
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../change.js';
import {
  Edge,
  Leaf,
  isComponent,
  isReverseEdge,
  type Component,
  type ReverseEdge,
} from '../definition.js';
import type { NodeFilter } from '../statement/filter.js';
import type { NodeOrdering } from '../statement/ordering.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../statement/selection.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';

/**
 * Example:
 *
 * articles(
 *   where: {
 *     category: { title: "My category" },
 *     tagCount_gte: 5,
 *     logCount_gt: 0
 *   },
 *   orderBy: [tagCount_DESC]
 * ): {
 *   slug
 *   title
 *   category { slug }
 *   tags (where: { tag: { status: PUBLISHED } }, orderBy: [order_ASC], first: 10) { slug }
 * }
 *
 * ->
 *
 * category
 *   title
 *   slug
 * tags
 *   article
 *   tag
 *     status
 *     slug
 *   order
 * logs
 *   article
 * slug
 * title
 */
export type DependencyTree = ReadonlyMap<
  Component | ReverseEdge,
  DependencyTree | undefined
>;

export type ReverseEdgeDependencyTree = ReadonlyMap<
  ReverseEdge,
  DependencyTree
>;

export type FlatDependencies = ReadonlyMap<Node, ReadonlySet<Component>>;

export function mergeDependencyTrees(
  maybeDependencyTrees: ReadonlyArray<DependencyTree | undefined>,
): DependencyTree | undefined {
  const dependencyTrees = maybeDependencyTrees.filter(
    (maybeDependencyTree): maybeDependencyTree is DependencyTree =>
      maybeDependencyTree != null,
  );

  if (dependencyTrees.length === 0) {
    return;
  } else if (dependencyTrees.length === 1) {
    return dependencyTrees[0];
  }

  const mergedDependencyTree = new Map<
    Component | ReverseEdge,
    DependencyTree | undefined
  >();

  let currentNode: Node | undefined;

  for (const dependencies of dependencyTrees) {
    for (const [dependency, subDependencyTree] of dependencies) {
      const node = isComponent(dependency) ? dependency.node : dependency.tail;

      assert.equal(
        node,
        (currentNode ??= node),
        `The dependency ${dependency} does not belong to the node ${currentNode}`,
      );

      if (dependency instanceof Leaf) {
        mergedDependencyTree.set(dependency, undefined);
      } else {
        mergedDependencyTree.set(
          dependency,
          mergeDependencyTrees([
            mergedDependencyTree.get(dependency),
            subDependencyTree,
          ]),
        );
      }
    }
  }

  return mergedDependencyTree.size ? mergedDependencyTree : undefined;
}

function flattenDirectDependencyTree(
  node: Node,
  dependencies: DependencyTree,
): Map<Node, Set<Component>> {
  const flatDependencies: Map<Node, Set<Component>> = new Map();

  let componentSet = flatDependencies.get(node);
  if (!componentSet) {
    flatDependencies.set(node, (componentSet = new Set<Component>()));
  }

  for (const [dependency, subDependencyTree] of dependencies) {
    if (isComponent(dependency)) {
      componentSet.add(dependency);
    } else if (isReverseEdge(dependency) && subDependencyTree) {
      let headComponentSet = flatDependencies.get(dependency.head);
      if (!headComponentSet) {
        flatDependencies.set(
          dependency.head,
          (headComponentSet = new Set<Component>()),
        );
      }

      for (const headDependency of subDependencyTree.keys()) {
        if (isComponent(headDependency)) {
          headComponentSet.add(headDependency);
        }
      }
    }
  }

  return flatDependencies;
}

function flattenDependencyTree(
  node: Node,
  dependencies: DependencyTree,
  flatDependencies: Map<Node, Set<Component>> = new Map(),
): Map<Node, Set<Component>> {
  let componentSet = flatDependencies.get(node);
  if (!componentSet) {
    flatDependencies.set(node, (componentSet = new Set<Component>()));
  }

  for (const [dependency, subDependencyTree] of dependencies) {
    if (isComponent(dependency)) {
      componentSet.add(dependency);
    }

    if (
      subDependencyTree &&
      (dependency instanceof Edge || isReverseEdge(dependency))
    ) {
      flattenDependencyTree(
        dependency.head,
        subDependencyTree,
        flatDependencies,
      );
    }
  }

  return flatDependencies;
}

export function toTestableDependencies(
  dependencies: DependencyTree | undefined,
): Record<string, any> | undefined {
  return dependencies
    ? Object.fromEntries(
        Array.from(dependencies, ([dependency, subDependencies]) => [
          dependency.name,
          subDependencies ? toTestableDependencies(subDependencies) : true,
        ]),
      )
    : undefined;
}

export function toTestableFlatDependencies(
  dependencies: FlatDependencies,
): Record<string, any> {
  return Object.fromEntries(
    Array.from(dependencies, ([node, components]) => [
      node.name,
      Array.from(components, (component) => component.name),
    ]),
  );
}

export type ResultSetMutabilityConfig<TValue extends NodeSelectedValue = any> =
  {
    filter?: NodeFilter;
    ordering?: NodeOrdering;
    selection: NodeSelection<TValue>;
  };

/**
 * A result-set is the set of results returned by a query
 *
 * @see https://en.wikipedia.org/wiki/Result_set
 */
export class ResultSetMutability<TValue extends NodeSelectedValue = any> {
  readonly #filter?: NodeFilter;
  readonly #ordering?: NodeOrdering;
  readonly #selection: NodeSelection<TValue>;

  /**
   * List of the components & reverse-edges whom changes may change the result-set
   */
  public readonly dependencies: DependencyTree;

  /**
   * List of the reverse-edges whom changes may change the result-set
   */
  public readonly reverseEdgeDependencies: ReverseEdgeDependencyTree;

  /**
   * List of the nodes' components whom changes may change the result-set, only for direct dependencies
   *
   * Convenient to be matched against NodeChangeAggregation.flatChanges when we only want relevant changes and references
   */
  public readonly flatDirectDependencies: FlatDependencies;

  /**
   * List of the nodes' components whom changes may change the result-set
   *
   * Convenient to be matched against NodeChangeAggregation.flatChanges
   */
  public readonly flatDependencies: FlatDependencies;

  public constructor(
    public readonly node: Node,
    config: Readonly<ResultSetMutabilityConfig<TValue>>,
  ) {
    this.#filter = config.filter?.normalized;
    this.#ordering = config.ordering?.normalized;
    this.#selection = config.selection;

    this.dependencies = mergeDependencyTrees([
      this.#filter?.dependencies,
      this.#ordering?.dependencies,
      this.#selection.dependencies,
    ])!;

    this.reverseEdgeDependencies = new Map(
      Array.from(this.dependencies).filter(
        (entry): entry is [ReverseEdge, DependencyTree] =>
          isReverseEdge(entry[0]) && entry[1] != null,
      ),
    );

    this.flatDirectDependencies = flattenDirectDependencyTree(
      node,
      this.dependencies,
    );

    this.flatDependencies = flattenDependencyTree(node, this.dependencies);
  }

  /**
   * Is there an intersection between these changes and this result-set's direct dependencies?
   */
  public areChangesDirectlyRelevant(
    aggregation: NodeChangeAggregation,
  ): boolean {
    return Array.from(aggregation.flatChanges).some(([node, componentSet]) => {
      const dependencies = this.flatDirectDependencies.get(node);

      return (
        dependencies &&
        Array.from(componentSet).some((component) =>
          dependencies.has(component),
        )
      );
    });
  }

  protected findRelevantReferences(
    reverseEdge: ReverseEdge,
    reverseEdgeHeadChange: NodeChange,
    dependencies: DependencyTree,
  ): NonNullable<NodeUniqueFilterInputValue>[] {
    const references: NonNullable<NodeUniqueFilterInputValue>[] = [];

    if (reverseEdgeHeadChange instanceof NodeCreation) {
      reverseEdgeHeadChange.newValue[reverseEdge.originalEdge.name] &&
        references.push(
          reverseEdgeHeadChange.newValue[reverseEdge.originalEdge.name],
        );
    } else if (reverseEdgeHeadChange instanceof NodeUpdate) {
      if (
        Array.from(reverseEdgeHeadChange.updatesByComponent.keys()).some(
          (component) => dependencies.has(component),
        )
      ) {
        reverseEdgeHeadChange.newValue[reverseEdge.originalEdge.name] &&
          references.push(
            reverseEdgeHeadChange.newValue[reverseEdge.originalEdge.name],
          );

        reverseEdgeHeadChange.oldValue[reverseEdge.originalEdge.name] &&
          references.push(
            reverseEdgeHeadChange.oldValue[reverseEdge.originalEdge.name],
          );
      }
    } else {
      reverseEdgeHeadChange.oldValue[reverseEdge.originalEdge.name] &&
        references.push(
          reverseEdgeHeadChange.oldValue[reverseEdge.originalEdge.name],
        );
    }

    return references;
  }

  public pickRelevantChanges(
    aggregation: NodeChangeAggregation,
  ): NodeChange[] | undefined {
    const changes = aggregation.changesByNode.get(this.node);
    if (changes?.length) {
      const filteredChanges = changes.filter((change) => {
        if (change instanceof NodeCreation) {
          return this.#filter?.execute(change.newValue) !== false;
        } else if (change instanceof NodeDeletion) {
          return this.#filter?.execute(change.oldValue) !== false;
        }

        const oldFilter = this.#filter?.execute(change.oldValue);
        const newFilter = this.#filter?.execute(change.newValue);

        if (oldFilter === false && newFilter === false) {
          return false;
        }

        if (
          oldFilter !== newFilter ||
          Array.from(change.updatesByComponent.keys()).some(
            (component) =>
              this.#ordering?.dependencies?.has(component) ||
              this.#selection.dependencies.has(component),
          )
        ) {
          return true;
        }

        // If we did not return yet, it means that the change is not relevant by itself
        // let's find if a related reverse-edge has been changed
        return Array.from(this.reverseEdgeDependencies).some(
          ([reverseEdge, dependencies]) => {
            const reverseEdgeHeadChanges = aggregation.changesByNode.get(
              reverseEdge.head,
            );

            return reverseEdgeHeadChanges?.some((reverseEdgeHeadChange) =>
              this.findRelevantReferences(
                reverseEdge,
                reverseEdgeHeadChange,
                dependencies,
              ).some((reference) =>
                this.node.filterInputType
                  .filter(reference)
                  .execute(change.newValue, false),
              ),
            );
          },
        );
      });

      if (filteredChanges.length) {
        return filteredChanges;
      }
    }
  }

  public pickRelevantReferences(
    aggregation: NodeChangeAggregation,
  ): NonNullable<NodeUniqueFilterInputValue>[] | undefined {
    const references: NonNullable<NodeUniqueFilterInputValue>[] = [];

    for (const [reverseEdge, dependencies] of this.reverseEdgeDependencies) {
      const reverseEdgeHeadChanges = aggregation.changesByNode.get(
        reverseEdge.head,
      );

      if (reverseEdgeHeadChanges?.length) {
        for (const reverseEdgeHeadChange of reverseEdgeHeadChanges) {
          references.push(
            ...this.findRelevantReferences(
              reverseEdge,
              reverseEdgeHeadChange,
              dependencies,
            ),
          );
        }
      }
    }

    // Here are the references of the nodes that may have changed
    const uniqReferences =
      this.node.uniqueFilterInputType.uniqValues(references);

    if (uniqReferences.length) {
      // If they refer to changes, we ignore them, as we processed them more efficiently before
      const changes = aggregation.changesByNode.get(this.node);
      if (changes?.length) {
        const filteredUniqReferences = uniqReferences.filter((reference) => {
          const filter = this.node.filterInputType.filter(reference);

          return !changes.some((change) =>
            filter.execute(
              change instanceof NodeDeletion
                ? change.oldValue
                : change.newValue,
              false,
            ),
          );
        });

        if (filteredUniqReferences.length) {
          return filteredUniqReferences;
        }
      } else {
        return uniqReferences;
      }
    }
  }

  /**
   * Is there an intersection between these changes and this result-set's dependencies?
   */
  public areChangesRelevant(aggregation: NodeChangeAggregation): boolean {
    return Array.from(aggregation.flatChanges).some(([node, componentSet]) => {
      const dependencies = this.flatDependencies.get(node);

      return (
        dependencies &&
        Array.from(componentSet).some((component) =>
          dependencies.has(component),
        )
      );
    });
  }

  public pickRelevantFilters(
    aggregation: NodeChangeAggregation,
  ): NodeFilterInputValue[] | undefined {
    // TODO: Implement

    return undefined;
  }
}
