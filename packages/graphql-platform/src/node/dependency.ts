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
  Edge,
  isComponent,
  Leaf,
  type Component,
} from './definition/component.js';
import { isReverseEdge, type ReverseEdge } from './definition/reverse-edge.js';
import { DependentGraph, DependentNode } from './dependency/dependent-graph.js';
import { FlattenedNodeDependencyTree } from './dependency/flattened.js';
import { NodeDependency } from './dependency/node.js';
import type { DependencyPath } from './dependency/path.js';
import type { RawDependency } from './dependency/raw.js';
import { MutationContextChanges } from './operation/mutation/context/changes.js';
import type { NodeFilter } from './statement/filter.js';
import type { NodeOrdering } from './statement/ordering.js';
import type { NodeSelection } from './statement/selection.js';

export * from './dependency/dependent-graph.js';
export * from './dependency/flattened.js';
export * from './dependency/node.js';
export * from './dependency/path.js';
export * from './dependency/raw.js';

export interface NodeDependencyTreeConfig {
  filter?: NodeFilter;
  ordering?: NodeOrdering;
  selection?: NodeSelection;
  dependencies?: ReadonlyArray<RawDependency | undefined>;
}

export class NodeDependencyTree {
  public readonly parent?: NodeDependencyTree;

  public readonly filter?: NodeFilter;
  public readonly ordering?: NodeOrdering;
  public readonly selection?: NodeSelection;

  public readonly dependencies: ReadonlyMap<
    Component | ReverseEdge,
    ReadonlyArray<EdgeDependency | ReverseEdgeDependency>
  >;

  public constructor(
    public readonly node: Node,
    config?: NodeDependencyTreeConfig,
  ) {
    utils.assertNillablePlainObject(config);

    if (config?.filter) {
      assert.strictEqual(config.filter.node, node);

      this.filter = config.filter.normalized;
    }

    if (config?.ordering) {
      assert.strictEqual(config.ordering.node, node);

      this.ordering = config.ordering.normalized;
    }

    if (config?.selection) {
      assert.strictEqual(config.selection.node, node);

      this.selection = config.selection;
    }

    const dependencies = new Map<
      Component | ReverseEdge,
      Array<EdgeDependency | ReverseEdgeDependency>
    >();

    const rawDependencies: NodeDependencyTreeConfig['dependencies'] = [
      ...[this.filter, this.ordering, this.selection]
        .values()
        .filter(R.isDefined)
        .flatMap(({ dependencyTree }) => dependencyTree.dependencies),
      ...(config?.dependencies ?? []),
    ];

    if (rawDependencies?.length) {
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

    if (!this.currentLevel?.dependsOn(change)) {
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

  private processChanges<TRequestContext extends object>(
    changes: MutationContextChanges<TRequestContext>,
    discardedChanges?: ReadonlySet<NodeChange<TRequestContext>>,
  ):
    | {
        hits?: Set<NodeChange<TRequestContext>>;
        children?: IteratorObject<
          [Edge | ReverseEdge, DependentNode | undefined]
        >;
      }
    | undefined {
    if (!this.flattened.dependsOnChanges(changes)) {
      return;
    }

    const currentLevelChanges = changes.changesByNode.get(this.node);

    const currentLevelHits = new Set(
      this.currentLevel
        ?.filterChanges(currentLevelChanges)
        ?.filter((change) => !discardedChanges?.has(change))
        ?.filter((change) => this.currentLevelDependsOn(change)),
    );

    let currentLevelVisits: Readonly<NodeValue>[] | undefined;
    if (
      currentLevelChanges?.size &&
      this.children
        .keys()
        .some(
          (edge) => isReverseEdge(edge) && changes.changesByNode.has(edge.head),
        )
    ) {
      currentLevelVisits = currentLevelHits
        .union(
          new Set(
            this.filter
              ? Iterator.from(currentLevelChanges).filter(
                  (change) =>
                    !currentLevelHits.has(change) &&
                    this.filter!.isChangeFilteredOut(change),
                )
              : undefined,
          ),
        )
        .values()
        .flatMap((change) =>
          R.pipe(
            change instanceof NodeCreation
              ? [change.newValue]
              : change instanceof NodeDeletion
                ? [change.oldValue]
                : [change.newValue, change.oldValue],
            R.map(
              R.pick(
                Array.from(
                  this.node.componentsInUniqueConstraints,
                  ({ name }) => name,
                ),
              ),
            ),
            R.uniqueWith(R.isDeepEqual),
          ),
        )
        .toArray();
    }

    const children = this.children
      .entries()
      .map(
        ([edgeOrReverseEdge, children]): [
          Edge | ReverseEdge,
          DependentNode | undefined,
        ] => {
          let discardedHeadChanges: Set<NodeChange> | undefined;

          const headChanges = changes.changesByNode.get(edgeOrReverseEdge.head);
          if (headChanges?.size) {
            if (edgeOrReverseEdge instanceof Edge) {
              if (this.filter) {
                discardedHeadChanges = new Set(
                  Iterator.from(headChanges).filter((change) =>
                    this.filter!.isEdgeHeadChangeFilteredOut(change),
                  ),
                );
              }
            } else {
              discardedHeadChanges = new Set(
                Iterator.from(headChanges).filter((change) => {
                  const filter = this.node.filterInputType.filter(
                    change instanceof NodeCreation
                      ? change.newValue[edgeOrReverseEdge.originalEdge.name]
                      : change instanceof NodeDeletion
                        ? change.oldValue[edgeOrReverseEdge.originalEdge.name]
                        : {
                            OR: [
                              change.newValue[
                                edgeOrReverseEdge.originalEdge.name
                              ],
                              change.oldValue[
                                edgeOrReverseEdge.originalEdge.name
                              ],
                            ],
                          },
                  );

                  return (
                    filter.isFalse() ||
                    currentLevelVisits?.some((currentLevelVisitedNode) =>
                      filter.execute(currentLevelVisitedNode, false),
                    )
                  );
                }),
              );
            }
          }

          return [
            edgeOrReverseEdge,
            children.reduce<DependentNode | undefined>((current, child) => {
              const childDependentNode = child.createDependentNode(
                changes,
                discardedHeadChanges?.size ? discardedHeadChanges : undefined,
              );

              return current
                ? current.mergeWith(childDependentNode)
                : childDependentNode;
            }, undefined),
          ];
        },
      );

    return { hits: currentLevelHits, children };
  }

  public createDependentNode<TRequestContext extends object>(
    changes: MutationContextChanges<TRequestContext>,
    discardedChanges?: ReadonlySet<NodeChange<TRequestContext>>,
  ): DependentNode<TRequestContext> | undefined {
    assert(this.path.length > 1, 'HitNode can only be created from children');

    const processedChanges = this.processChanges(changes, discardedChanges);
    if (!processedChanges) {
      return;
    }

    const { hits, children } = processedChanges;

    return new DependentNode(this.path, hits, children).normalized;
  }

  public createDependentGraph<TRequestContext extends object>(
    rawChanges:
      | MutationContextChanges<TRequestContext>
      | utils.ReadonlyArrayable<NodeChange<TRequestContext>>,
  ): DependentGraph<TRequestContext> | undefined {
    assert(
      this.path.length === 1,
      'DependentGraph can only be created from the root-node',
    );

    const changes =
      rawChanges instanceof MutationContextChanges
        ? rawChanges
        : MutationContextChanges.createFromChanges(rawChanges);

    const processedChanges = this.processChanges(changes);
    if (!processedChanges) {
      return;
    }

    const { hits, children } = processedChanges;

    const deletions = new Set<NodeDeletion | NodeUpdate>();
    const deletionOrUpserts = new Set<NodeUpdate>();
    const upsertIfFilteredIns = new Set<NodeCreation | NodeUpdate>();
    const upserts = new Set<NodeCreation | NodeUpdate>();

    hits?.forEach((hit) => {
      if (hit instanceof NodeCreation) {
        const filterValue =
          !this.filter || this.filter.execute(hit.newValue, true);

        if (filterValue) {
          upserts.add(hit);
        } else {
          upsertIfFilteredIns.add(hit);
        }
      } else if (hit instanceof NodeDeletion) {
        deletions.add(hit);
      } else {
        const newFilterValue =
          !this.filter || this.filter.execute(hit.newValue, true);

        switch (newFilterValue) {
          case true:
            upserts.add(hit);
            break;

          case false:
            deletions.add(hit);
            break;

          case undefined:
            const oldFilterValue =
              !this.filter || this.filter.execute(hit.oldValue, true);

            if (oldFilterValue === false) {
              upsertIfFilteredIns.add(hit);
            } else {
              deletionOrUpserts.add(hit);
            }
            break;
        }
      }
    });

    return new DependentGraph(
      changes,
      this.path,
      this.filter,
      deletions,
      deletionOrUpserts,
      upsertIfFilteredIns,
      upserts,
      children,
    ).normalized;
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

export class EdgeDependency extends NodeDependencyTree {
  public constructor(
    public override readonly parent: NodeDependencyTree,
    public readonly edge: Edge,
    protected readonly config?: NodeDependencyTreeConfig,
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

export class DocumentSetDependency extends NodeDependencyTree {
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
    protected readonly config?: NodeDependencyTreeConfig,
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
}
