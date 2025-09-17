import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import * as R from 'remeda';
import type { JsonObject } from 'type-fest';
import type { Node, NodeValue } from '../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from './change.js';
import {
  isComponent,
  Leaf,
  type Component,
  type Edge,
} from './definition/component.js';
import { isReverseEdge, type ReverseEdge } from './definition/reverse-edge.js';
import { FlattenedNodeDependencyTree } from './dependency/flattened.js';
import { ImpactTree } from './dependency/impact-tree.js';
import { NodeDependency } from './dependency/node.js';
import { type DependencyPath } from './dependency/path.js';
import type { RawDependency } from './dependency/raw.js';
import { MutationContextChanges } from './operation/mutation/context/changes.js';
import type { NodeFilter } from './statement/filter.js';
import type { NodeOrdering } from './statement/ordering.js';
import type { NodeSelection } from './statement/selection.js';

export * from './dependency/flattened.js';
export * from './dependency/impact-tree.js';
export * from './dependency/node.js';
export * from './dependency/path.js';
export * from './dependency/raw.js';

export class NodeDependencyTree {
  public readonly parent?: NodeDependencyTree;

  public readonly dependencies: ReadonlyMap<
    Component | ReverseEdge,
    ReadonlyArray<EdgeDependency | ReverseEdgeDependency>
  >;

  public constructor(
    public readonly node: Node,
    rawDependencies?: ReadonlyArray<RawDependency | undefined>,
  ) {
    const dependencies = new Map<
      Component | ReverseEdge,
      Array<EdgeDependency | ReverseEdgeDependency>
    >();

    if (rawDependencies) {
      for (const rawDependency of rawDependencies) {
        if (rawDependency) {
          if ('kind' in rawDependency) {
            switch (rawDependency.kind) {
              case 'Leaf': {
                const { leaf } = rawDependency;
                assert.strictEqual(leaf.node, node);

                if (leaf.isMutable() && !dependencies.has(leaf)) {
                  dependencies.set(leaf, []);
                }
                break;
              }

              case 'Edge': {
                const { edge, head } = rawDependency;
                assert.strictEqual(edge.tail, node);

                if (edge.isMutable() && !dependencies.has(edge)) {
                  dependencies.set(edge, []);
                }

                const child = new EdgeDependency(this, edge, head).normalized;

                if (child) {
                  dependencies.set(edge, [
                    ...(dependencies.get(edge) ?? []),
                    child,
                  ]);
                }
                break;
              }

              case 'ReverseEdge': {
                const { reverseEdge, head } = rawDependency;
                assert.strictEqual(reverseEdge.tail, node);

                const child = new ReverseEdgeDependency(this, reverseEdge, head)
                  .normalized;

                if (child) {
                  dependencies.set(reverseEdge, [
                    ...(dependencies.get(reverseEdge) ?? []),
                    child,
                  ]);
                }
                break;
              }

              default:
                throw new utils.UnreachableValueError(rawDependency);
            }
          } else if (isComponent(rawDependency)) {
            assert.strictEqual(rawDependency.node, node);

            if (rawDependency.isMutable() && !dependencies.has(rawDependency)) {
              dependencies.set(rawDependency, []);
            }
          } else if (Array.isArray(rawDependency)) {
            const [key, values] = rawDependency;

            if (key instanceof Leaf) {
              assert.strictEqual(key.node, node);

              if (!dependencies.has(key)) {
                dependencies.set(key, []);
              }
            } else {
              assert.strictEqual(key.tail, node);

              dependencies.set(key, [
                ...(dependencies.get(key) ?? []),
                ...values
                  .filter((value) => value.normalized)
                  .map((value) => value.attachTo(this)),
              ]);
            }
          } else {
            throw new utils.UnreachableValueError(rawDependency);
          }
        }
      }
    }

    this.dependencies = dependencies;
  }

  @MGetter
  public get path(): DependencyPath {
    return [this.node];
  }

  @MGetter
  protected get currentLevel(): NodeDependency | undefined {
    return new NodeDependency(this.node, {
      [utils.MutationType.UPDATE]: new Set(
        this.dependencies
          .keys()
          .filter(
            (key): key is Component => isComponent(key) && key.isMutable(),
          ),
      ),
    }).normalized;
  }

  @MGetter
  public get normalized(): this | undefined {
    return this.dependencies.size || this.currentLevel ? this : undefined;
  }

  @MGetter
  protected get children(): ReadonlyMap<
    Edge | ReverseEdge,
    ReadonlyArray<EdgeDependency | ReverseEdgeDependency>
  > {
    return new Map(
      this.dependencies
        .entries()
        .filter(
          (
            entry,
          ): entry is [
            Edge | ReverseEdge,
            ReadonlyArray<EdgeDependency | ReverseEdgeDependency>,
          ] => !(entry[0] instanceof Leaf) && entry[1].length > 0,
        ),
    );
  }

  @MGetter
  public get flattened(): FlattenedNodeDependencyTree {
    const dependencies = new Map<Node, NodeDependency>();

    if (this.currentLevel) {
      dependencies.set(this.node, this.currentLevel);
    }

    for (const children of this.dependencies.values()) {
      for (const child of children) {
        for (const [node, dependency] of child.flattened.dependencies) {
          const current = dependencies.get(node);

          dependencies.set(
            node,
            current ? current.mergeWith(dependency) : dependency,
          );
        }
      }
    }

    return new FlattenedNodeDependencyTree(dependencies);
  }

  public currentLevelDependsOn(change: NodeChange): boolean {
    assert.strictEqual(change.node, this.node);

    return this.currentLevel?.dependsOn(change) ?? false;
  }

  public toJSON(): JsonObject {
    return Object.fromEntries(
      this.dependencies
        .entries()
        .map(([{ name }, values]) => [
          name,
          values.length
            ? values.map((dependency) => dependency.toJSON())
            : true,
        ]),
    );
  }
}

export interface DocumentDependencyConfig {
  filter?: NodeFilter;
  ordering?: NodeOrdering;
  selection?: NodeSelection;
  dependencies?: ReadonlyArray<RawDependency | undefined>;
}

export class DocumentDependency extends NodeDependencyTree {
  public readonly filter?: NodeFilter;
  public readonly ordering?: NodeOrdering;
  public readonly selection?: NodeSelection;

  public constructor(node: Node, config?: DocumentDependencyConfig) {
    let filter: NodeFilter | undefined;
    let ordering: NodeOrdering | undefined;
    let selection: NodeSelection | undefined;

    if (config?.filter) {
      assert.strictEqual(config.filter.node, node);

      filter = config.filter.normalized;
    }

    if (config?.ordering) {
      assert.strictEqual(config.ordering.node, node);

      ordering = config.ordering.normalized;
    }

    if (config?.selection) {
      assert.strictEqual(config.selection.node, node);

      selection = config.selection;
    }

    super(node, [
      ...[filter, ordering, selection]
        .values()
        .filter(R.isDefined)
        .flatMap(({ dependencyTree }) => dependencyTree.dependencies),
      ...(config?.dependencies ?? []),
    ]);

    this.filter = filter;
    this.ordering = ordering;
    this.selection = selection;
  }

  public override currentLevelDependsOn(change: NodeChange): boolean {
    if (!super.currentLevelDependsOn(change)) {
      return false;
    }

    if (this.filter) {
      if (this.filter.isChangeFilteredOut(change)) {
        return false;
      }

      // If the update doesn't actually affect the filter value, discard it if it doesn't affect the ordering or selection
      if (
        change instanceof NodeUpdate &&
        this.filter.dependencyTree.currentLevelDependsOn(change)
      ) {
        const oldFilterValue = this.filter.execute(change.oldValue, true);
        const newFilterValue = this.filter.execute(change.newValue, true);

        if (
          oldFilterValue !== undefined &&
          newFilterValue !== undefined &&
          oldFilterValue === newFilterValue &&
          !this.ordering?.dependencyTree.currentLevelDependsOn(change) &&
          !this.selection?.dependencyTree.currentLevelDependsOn(change)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  public createImpactTree<TRequestContext extends object>(
    changes: MutationContextChanges<TRequestContext>,
    discardedChanges?: ReadonlySet<NodeChange<TRequestContext>>,
  ): ImpactTree<TRequestContext> | undefined {
    if (!this.flattened.dependsOnChanges(changes)) {
      return;
    }

    const currentLevelImpactfulChanges = this.currentLevel
      // Current level filtering: keep the changes relevant to the current level
      ?.filterChanges(changes.changesByNode.get(this.node))
      // These "discardedChanges"' parent have been processed already
      ?.filter((change) => !discardedChanges?.has(change))
      // Apply the final optimizations
      ?.filter((change) => this.currentLevelDependsOn(change));

    /**
     * We keep the "impactful" and "filtered-out" changes, we'll use
     * them to avoid useless processing of theirs reverse-edges below
     */
    let currentLevelVisitedNodes: Readonly<NodeValue>[] | undefined;
    if (
      changes.changesByNode.has(this.node) &&
      this.children
        .keys()
        .some(
          (edge) => isReverseEdge(edge) && changes.changesByNode.has(edge.head),
        )
    ) {
      const impactfulChanges = new Set(currentLevelImpactfulChanges);
      const filteredOutChanges = new Set(
        this.filter
          ? new Set(changes.changesByNode.get(this.node))
              .difference(impactfulChanges)
              .values()
              .filter((change) => this.filter!.isChangeFilteredOut(change))
          : undefined,
      );

      currentLevelVisitedNodes = impactfulChanges
        .union(filteredOutChanges)
        .values()
        .flatMap(({ oldValue, newValue }) => [oldValue, newValue])
        .filter(R.isDefined)
        .toArray();
    }

    return new ImpactTree(
      this.path,
      currentLevelImpactfulChanges,
      this.children
        .entries()
        .map(
          ([edge, children]): [Edge | ReverseEdge, ImpactTree | undefined] => {
            let discardedChanges: Set<NodeChange> | undefined;
            if (
              isReverseEdge(edge) &&
              currentLevelVisitedNodes?.length &&
              changes.changesByNode.has(edge.head)
            ) {
              discardedChanges = new Set(
                Iterator.from(changes.changesByNode.get(edge.head)!).filter(
                  (change) => {
                    const filter = this.node.filterInputType.filter(
                      change instanceof NodeCreation
                        ? change.newValue[edge.originalEdge.name]
                        : change instanceof NodeDeletion
                          ? change.oldValue[edge.originalEdge.name]
                          : {
                              OR: [
                                change.newValue[edge.originalEdge.name],
                                change.oldValue[edge.originalEdge.name],
                              ],
                            },
                    );

                    return (
                      filter.isFalse() ||
                      currentLevelVisitedNodes.some((currentLevelVisitedNode) =>
                        filter.execute(currentLevelVisitedNode, false),
                      )
                    );
                  },
                ),
              );
            }

            return [
              edge,
              children.reduce<ImpactTree | undefined>((current, child) => {
                const childImpactTree = child.createImpactTree(
                  changes,
                  discardedChanges,
                );

                return current
                  ? current.mergeWith(childImpactTree)
                  : childImpactTree;
              }, undefined),
            ];
          },
        ),
    ).normalized;
  }
}

export class EdgeDependency extends DocumentDependency {
  public constructor(
    public override readonly parent: NodeDependencyTree,
    public readonly edge: Edge,
    protected readonly config?: DocumentDependencyConfig,
  ) {
    assert.strictEqual(edge.tail, parent.node);

    super(edge.head, config);
  }

  @MGetter
  public override get path(): DependencyPath {
    return [...this.parent.path, this.edge];
  }

  public attachTo(parent: NodeDependencyTree): this | EdgeDependency {
    return new EdgeDependency(parent, this.edge, this.config);
  }
}

export class DocumentSetDependency extends DocumentDependency {
  @MGetter
  protected override get currentLevel(): NodeDependency | undefined {
    return new NodeDependency(this.node, {
      [utils.MutationType.CREATION]: this.node.isCreatable(),
      [utils.MutationType.DELETION]: this.node.isDeletable(),
    }).mergeWith(super.currentLevel).normalized;
  }
}

export class ReverseEdgeDependency extends DocumentSetDependency {
  public constructor(
    public override readonly parent: NodeDependencyTree,
    public readonly reverseEdge: ReverseEdge,
    protected readonly config?: DocumentDependencyConfig,
  ) {
    assert.strictEqual(reverseEdge.tail, parent.node);

    super(reverseEdge.head, {
      ...config,
      dependencies: [...(config?.dependencies ?? []), reverseEdge.originalEdge],
    });
  }

  @MGetter
  public override get path(): DependencyPath {
    return [...this.parent.path, this.reverseEdge];
  }

  public attachTo(parent: NodeDependencyTree): this | ReverseEdgeDependency {
    return new ReverseEdgeDependency(parent, this.reverseEdge, this.config);
  }

  public override currentLevelDependsOn(change: NodeChange): boolean {
    if (!super.currentLevelDependsOn(change)) {
      return false;
    }

    // If the change has no "original-edge" value, it cannot affect the graph
    if (
      change instanceof NodeCreation
        ? !change.newValue[this.reverseEdge.originalEdge.name]
        : change instanceof NodeDeletion
          ? !change.oldValue[this.reverseEdge.originalEdge.name]
          : !change.newValue[this.reverseEdge.originalEdge.name] &&
            !change.oldValue[this.reverseEdge.originalEdge.name]
    ) {
      return false;
    }

    return true;
  }
}
