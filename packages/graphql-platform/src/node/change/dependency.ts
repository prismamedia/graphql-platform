import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import { Node, type NodeValue } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from '../change.js';
import {
  Edge,
  isComponent,
  UniqueReverseEdge,
  type Component,
  type ReverseEdge,
} from '../definition.js';
import { MutationContextChanges } from '../operation/mutation/context/changes.js';
import {
  EdgeExistsFilter,
  MultipleReverseEdgeExistsFilter,
  NodeFilter,
  NodeOrdering,
  NodeSelection,
  OrOperation,
  UniqueReverseEdgeExistsFilter,
} from '../statement.js';
import { FlattenedDependencyGraph } from './dependency/flattened.js';

export * from './dependency/flattened.js';

export type Dependency =
  | EdgeDependencyGraph
  | ReverseEdgeDependencyGraph
  | DependencyGraph
  | Component;

export enum DependentKind {
  /**
   * Already filtered-in, no need to check the filter again, just upsert
   */
  UPSERT = 1,

  /**
   * The filter must be checked, upsert if found, do nothing if not
   */
  UPSERT_IF_FOUND,

  /**
   * Just delete
   */
  DELETION,
}

export class DependencyGraph {
  public readonly filter?: NodeFilter;
  public readonly ordering?: NodeOrdering;
  public readonly selection?: NodeSelection;

  public readonly [utils.MutationType.CREATION]: boolean = false;
  public readonly [utils.MutationType.UPDATE]: ReadonlySet<Component>;
  public readonly [utils.MutationType.DELETION]: boolean = false;

  public readonly dependenciesByEdge: ReadonlyMap<
    Edge,
    ReadonlyArray<EdgeDependencyGraph>
  >;

  public readonly dependenciesByReverseEdge: ReadonlyMap<
    ReverseEdge,
    ReadonlyArray<ReverseEdgeDependencyGraph>
  >;

  public readonly graphDependencies: ReadonlyArray<
    EdgeDependencyGraph | ReverseEdgeDependencyGraph
  >;

  public constructor(
    public readonly node: Node,
    ...dependencies: ReadonlyArray<
      utils.ReadonlyArrayable<Dependency | undefined>
    >
  ) {
    const update = new Set<Component>();
    const dependenciesByEdge = new Map<Edge, EdgeDependencyGraph[]>();
    const dependenciesByReverseEdge = new Map<
      ReverseEdge,
      ReverseEdgeDependencyGraph[]
    >();

    for (const dependency of dependencies.flat()) {
      if (dependency instanceof EdgeDependencyGraph) {
        const edge = dependency.edge;
        assert.strictEqual(edge.tail, this.node);
        edge.isMutable() && update.add(edge);

        let dependencies = dependenciesByEdge.get(edge);
        if (!dependencies) {
          dependenciesByEdge.set(edge, (dependencies = []));
        }

        dependencies.push(dependency);
      } else if (dependency instanceof ReverseEdgeDependencyGraph) {
        const reverseEdge = dependency.reverseEdge;
        assert.strictEqual(reverseEdge.tail, this.node);

        let dependencies = dependenciesByReverseEdge.get(reverseEdge);
        if (!dependencies) {
          dependenciesByReverseEdge.set(reverseEdge, (dependencies = []));
        }

        dependencies.push(dependency);
      } else if (dependency instanceof DependencyGraph) {
        assert.strictEqual(dependency.node, this.node);

        dependency.update.forEach((component) => update.add(component));

        dependency.dependenciesByEdge.forEach((others, edge) => {
          if (others.length) {
            let currents = dependenciesByEdge.get(edge);
            if (!currents) {
              dependenciesByEdge.set(edge, (currents = []));
            }

            currents.push(...others);
          }
        });

        dependency.dependenciesByReverseEdge.forEach((others, reverseEdge) => {
          if (others.length) {
            let currents = dependenciesByReverseEdge.get(reverseEdge);
            if (!currents) {
              dependenciesByReverseEdge.set(reverseEdge, (currents = []));
            }

            currents.push(...others);
          }
        });
      } else if (isComponent(dependency)) {
        dependency.isMutable() && update.add(dependency);
      }
    }

    this.update = update;
    this.dependenciesByEdge = dependenciesByEdge;
    this.dependenciesByReverseEdge = dependenciesByReverseEdge;

    this.graphDependencies = [
      ...Array.from(dependenciesByEdge.values()).flat(),
      ...Array.from(dependenciesByReverseEdge.values()).flat(),
    ];
  }

  @MGetter
  public get flattened(): FlattenedDependencyGraph {
    return new FlattenedDependencyGraph(this);
  }

  public nodeDependsOnCreation(
    creation: NodeCreation,
    _visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind.UPSERT | DependentKind.UPSERT_IF_FOUND | false {
    assert.strictEqual(creation.node, this.node);

    if (!this.creation) {
      return false;
    }

    switch (!this.filter || this.filter.execute(creation.newValue, true)) {
      case true:
        return DependentKind.UPSERT;

      case undefined:
        return DependentKind.UPSERT_IF_FOUND;

      case false:
        return false;
    }
  }

  public nodeDependsOnUpdate(
    update: NodeUpdate,
    _visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind | false {
    assert.strictEqual(update.node, this.node);

    if (
      !this.update.size ||
      !update.updatesByComponent.size ||
      this.update.isDisjointFrom(update.updatesByComponent)
    ) {
      return false;
    }

    const oldFilterValue =
      !this.filter || this.filter.execute(update.oldValue, true);

    const newFilterValue =
      !this.filter || this.filter.execute(update.newValue, true);

    const filterIsDependent = oldFilterValue !== newFilterValue;

    const orderingOrSelectionIsDependent =
      this.ordering?.dependencyGraph.nodeDependsOnUpdate(update) !== false ||
      this.selection?.dependencyGraph.nodeDependsOnUpdate(update) !== false;

    if (!filterIsDependent) {
      if (!orderingOrSelectionIsDependent) {
        return false;
      }

      switch (newFilterValue) {
        case true:
          return DependentKind.UPSERT;

        case undefined:
          return DependentKind.UPSERT_IF_FOUND;

        case false:
          return false;
      }
    } else {
      switch (newFilterValue) {
        case true:
          return DependentKind.UPSERT;

        case undefined:
          return DependentKind.UPSERT_IF_FOUND;

        case false:
          return DependentKind.DELETION;
      }
    }
  }

  public nodeDependsOnDeletion(
    deletion: NodeDeletion,
    _visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind.DELETION | false {
    assert.strictEqual(deletion.node, this.node);

    if (!this.deletion) {
      return false;
    }

    switch (!this.filter || this.filter.execute(deletion.oldValue, true)) {
      case true:
      case undefined:
        return DependentKind.DELETION;

      case false:
        return false;
    }
  }

  public nodeDependsOnChange(
    change: NodeChange,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind | false {
    assert.strictEqual(change.node, this.node);

    return change instanceof NodeCreation
      ? this.nodeDependsOnCreation(change, visitedParents)
      : change instanceof NodeUpdate
        ? this.nodeDependsOnUpdate(change, visitedParents)
        : this.nodeDependsOnDeletion(change, visitedParents);
  }

  public dependsOnChange(change: NodeChange): boolean {
    if (!this.flattened.dependsOnChange(change)) {
      return false;
    }

    return (
      (this.node === change.node &&
        this.nodeDependsOnChange(change) !== false) ||
      this.graphDependencies.some((dependency) =>
        dependency.dependsOnChange(change),
      )
    );
  }

  public createDependentGraph<TRequestContext extends object>(
    changes:
      | MutationContextChanges<TRequestContext>
      | utils.ReadonlyArrayable<NodeChange<TRequestContext>>,
    visitedParents?: ReadonlyArray<NodeValue>,
    path?: Edge | ReverseEdge,
  ): DependentGraph<TRequestContext> {
    const aggregation =
      changes instanceof MutationContextChanges
        ? changes
        : new MutationContextChanges(
            undefined,
            utils.resolveArrayable(changes),
          );

    const hasReverseEdgeHeadChanges = this.dependenciesByReverseEdge
      .keys()
      .some(({ head }) => aggregation.changesByNode.get(head)?.size);

    const upserts = new Set<NodeCreation | NodeUpdate>();
    const upsertIfFounds = new Set<NodeCreation | NodeUpdate>();
    const deletions = new Set<NodeDeletion | NodeUpdate>();
    const filteredOuts: NodeValue[] = [];

    const changesByNode = aggregation.changesByNode.get(this.node);
    if (changesByNode) {
      const { creation, update, deletion } = changesByNode;

      creation.forEach((creation) => {
        switch (this.nodeDependsOnCreation(creation, visitedParents)) {
          case DependentKind.UPSERT:
            upserts.add(creation);
            break;

          case DependentKind.UPSERT_IF_FOUND:
            upsertIfFounds.add(creation);
            break;

          case false:
            hasReverseEdgeHeadChanges &&
              this.filter?.isCreationFilteredOut(creation) &&
              filteredOuts.push(creation.newValue);
            break;
        }
      });

      update.forEach((update) => {
        switch (this.nodeDependsOnUpdate(update, visitedParents)) {
          case DependentKind.UPSERT:
            upserts.add(update);
            break;

          case DependentKind.UPSERT_IF_FOUND:
            upsertIfFounds.add(update);
            break;

          case DependentKind.DELETION:
            deletions.add(update);
            break;

          case false:
            hasReverseEdgeHeadChanges &&
              this.filter?.isUpdateFilteredOut(update) &&
              filteredOuts.push(update.oldValue, update.newValue);
            break;
        }
      });

      deletion.forEach((deletion) => {
        switch (this.nodeDependsOnDeletion(deletion, visitedParents)) {
          case DependentKind.DELETION:
            deletions.add(deletion);
            break;

          case false:
            hasReverseEdgeHeadChanges &&
              this.filter?.isDeletionFilteredOut(deletion) &&
              filteredOuts.push(deletion.oldValue);
            break;
        }
      });
    }

    const visitedNodes = hasReverseEdgeHeadChanges
      ? [
          ...(!path && visitedParents?.length ? visitedParents : []),
          ...upserts
            .values()
            .flatMap((upsert) =>
              upsert instanceof NodeUpdate
                ? [upsert.oldValue, upsert.newValue]
                : [upsert.newValue],
            ),
          ...upsertIfFounds
            .values()
            .flatMap((upsertIfFound) =>
              upsertIfFound instanceof NodeUpdate
                ? [upsertIfFound.oldValue, upsertIfFound.newValue]
                : [upsertIfFound.newValue],
            ),
          ...deletions
            .values()
            .flatMap((deletion) =>
              deletion instanceof NodeUpdate
                ? [deletion.oldValue, deletion.newValue]
                : [deletion.oldValue],
            ),
          ...filteredOuts,
        ]
      : undefined;

    return new DependentGraph(
      aggregation,
      path ??
        this.filter?.dependencyGraph.createDependentGraph(
          aggregation,
          visitedNodes,
        ) ??
        this.node,
      deletions,
      upserts,
      upsertIfFounds,
      this.dependenciesByEdge
        .entries()
        .map(([edge, dependencies]) => [
          edge,
          new DependentGraph(aggregation, edge).mergeWith(
            ...dependencies.map((dependency) =>
              dependency.createDependentGraph(aggregation),
            ),
          ),
        ]),
      this.dependenciesByReverseEdge
        .entries()
        .map(([reverseEdge, dependencies]) => [
          reverseEdge,
          new DependentGraph(aggregation, reverseEdge).mergeWith(
            ...dependencies.map((dependency) =>
              dependency.createDependentGraph(aggregation, visitedNodes),
            ),
          ),
        ]),
    );
  }
}

export class NodeDependencyGraph extends DependencyGraph {
  public constructor(
    node: Node,
    public override readonly filter?: NodeFilter,
    public override readonly ordering?: NodeOrdering,
    public override readonly selection?: NodeSelection,
    ...dependencies: ReadonlyArray<Dependency | undefined>
  ) {
    filter && assert.strictEqual(filter.node, node);
    ordering && assert.strictEqual(ordering.node, node);
    selection && assert.strictEqual(selection.node, node);

    super(
      node,
      filter?.dependencyGraph,
      ordering?.dependencyGraph,
      selection?.dependencyGraph,
      ...dependencies,
    );
  }
}

export class NodeSetDependencyGraph extends NodeDependencyGraph {
  public override readonly creation: boolean;
  public override readonly deletion: boolean;

  public constructor(
    node: Node,
    filter?: NodeFilter,
    ordering?: NodeOrdering,
    selection?: NodeSelection,
    ...dependencies: ReadonlyArray<Dependency | undefined>
  ) {
    super(node, filter, ordering, selection, ...dependencies);

    this.creation = node.isCreatable();
    this.deletion = node.isDeletable();
  }
}

export class EdgeDependencyGraph extends NodeDependencyGraph {
  public constructor(
    public readonly edge: Edge,
    filter?: NodeFilter,
    selection?: NodeSelection,
  ) {
    super(edge.head, filter, undefined, selection);
  }

  public override createDependentGraph<TRequestContext extends object>(
    changes:
      | MutationContextChanges<TRequestContext>
      | utils.ReadonlyArrayable<NodeChange<TRequestContext>>,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentGraph<TRequestContext> {
    return super.createDependentGraph(changes, visitedParents, this.edge);
  }
}

export class ReverseEdgeDependencyGraph extends NodeSetDependencyGraph {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    filter?: NodeFilter,
    ordering?: NodeOrdering,
    selection?: NodeSelection,
  ) {
    super(
      reverseEdge.head,
      filter,
      ordering,
      selection,
      reverseEdge.originalEdge,
    );
  }

  public override nodeDependsOnCreation(
    creation: NodeCreation,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind.UPSERT | DependentKind.UPSERT_IF_FOUND | false {
    assert.strictEqual(creation.node, this.node);

    /**
     * If the creation has no "original-edge" value, it cannot affect any document
     */
    if (!creation.newValue[this.reverseEdge.originalEdge.name]) {
      return false;
    }

    /**
     * If the reverse-edge's tail has been visited, it is already being taken care of
     */
    if (visitedParents?.length) {
      const tailFilter = this.reverseEdge.tail.filterInputType.filter(
        creation.newValue[this.reverseEdge.originalEdge.name],
      );

      if (
        visitedParents.some((visitedParent) =>
          tailFilter.execute(visitedParent, false),
        )
      ) {
        return false;
      }
    }

    return super.nodeDependsOnCreation(creation, visitedParents);
  }

  public override nodeDependsOnUpdate(
    update: NodeUpdate,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind | false {
    assert.strictEqual(update.node, this.node);

    /**
     * If the update has no "original-edge" value, it cannot affect any document
     */
    if (
      !update.oldValue[this.reverseEdge.originalEdge.name] &&
      !update.newValue[this.reverseEdge.originalEdge.name]
    ) {
      return false;
    }

    /**
     * If the reverse-edge's tail has been visited, it is already being taken care of
     */
    if (visitedParents?.length) {
      const tailFilter = this.reverseEdge.tail.filterInputType.filter({
        OR: [
          update.oldValue[this.reverseEdge.originalEdge.name],
          update.newValue[this.reverseEdge.originalEdge.name],
        ],
      });

      if (
        visitedParents.some((visitedParent) =>
          tailFilter.execute(visitedParent, false),
        )
      ) {
        return false;
      }
    }

    return super.nodeDependsOnUpdate(update, visitedParents);
  }

  public override nodeDependsOnDeletion(
    deletion: NodeDeletion,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentKind.DELETION | false {
    assert.strictEqual(deletion.node, this.node);

    /**
     * If the deletion has no "original-edge" value, it cannot affect any document
     */
    if (!deletion.oldValue[this.reverseEdge.originalEdge.name]) {
      return false;
    }

    /**
     * If the reverse-edge's tail has been visited, it is already being taken care of
     */
    if (visitedParents?.length) {
      const tailFilter = this.reverseEdge.tail.filterInputType.filter(
        deletion.oldValue[this.reverseEdge.originalEdge.name],
      );

      if (
        visitedParents.some((visitedParent) =>
          tailFilter.execute(visitedParent, false),
        )
      ) {
        return false;
      }
    }

    return super.nodeDependsOnDeletion(deletion, visitedParents);
  }

  public override createDependentGraph<TRequestContext extends object>(
    changes:
      | MutationContextChanges<TRequestContext>
      | utils.ReadonlyArrayable<NodeChange<TRequestContext>>,
    visitedParents?: ReadonlyArray<NodeValue>,
  ): DependentGraph<TRequestContext> {
    return super.createDependentGraph(
      changes,
      visitedParents,
      this.reverseEdge,
    );
  }
}

export type DependentGraphJSON = JsonObject & {
  deletions?: string[];
  upserts?: string[];
  upsertIfFounds?: string[];
  dependentsByEdge?: Record<Edge['name'], DependentGraphJSON>;
  dependentsByReverseEdge?: Record<ReverseEdge['name'], DependentGraphJSON>;
};

export class DependentGraph<TRequestContext extends object = any> {
  public readonly path?: Edge | ReverseEdge;
  public readonly node: Node;

  /**
   * The dependent-graph of the filter only
   */
  public readonly filter?: DependentGraph<TRequestContext>;

  public readonly dependents: ReadonlySet<NodeChange<TRequestContext>>;

  public readonly dependentsByEdge: ReadonlyMap<
    Edge,
    DependentGraph<TRequestContext>
  >;

  public readonly dependentsByReverseEdge: ReadonlyMap<
    ReverseEdge,
    DependentGraph<TRequestContext>
  >;

  public constructor(
    public readonly changes: MutationContextChanges<TRequestContext>,
    nodeOrDependentGraphOrPath:
      | Node
      | DependentGraph<TRequestContext>
      | Edge
      | ReverseEdge,
    public readonly deletions: ReadonlySet<
      NodeDeletion<TRequestContext> | NodeUpdate<TRequestContext>
    > = new Set(),
    public readonly upserts: ReadonlySet<
      NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
    > = new Set(),
    public readonly upsertIfFounds: ReadonlySet<
      NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
    > = new Set(),
    dependentsByEdge?: IteratorObject<[Edge, DependentGraph]>,
    dependentsByReverseEdge?: IteratorObject<[ReverseEdge, DependentGraph]>,
  ) {
    if (nodeOrDependentGraphOrPath instanceof Node) {
      this.node = nodeOrDependentGraphOrPath;
    } else if (nodeOrDependentGraphOrPath instanceof DependentGraph) {
      this.filter = nodeOrDependentGraphOrPath;
      this.node = nodeOrDependentGraphOrPath.node;
    } else {
      this.path = nodeOrDependentGraphOrPath;
      this.node = nodeOrDependentGraphOrPath.head;
    }

    this.dependents = new Set([...deletions, ...upserts, ...upsertIfFounds]);

    this.dependentsByEdge = new Map(
      dependentsByEdge?.filter(([edge, dependents]) => {
        assert.strictEqual(edge.tail, this.node);
        assert.strictEqual(dependents.changes, this.changes);

        return !dependents.isEmpty();
      }),
    );

    this.dependentsByReverseEdge = new Map(
      dependentsByReverseEdge?.filter(([reverseEdge, dependents]) => {
        assert.strictEqual(reverseEdge.tail, this.node);
        assert.strictEqual(dependents.changes, this.changes);

        return !dependents.isEmpty();
      }),
    );
  }

  public mergeWith(
    ...others: ReadonlyArray<DependentGraph<TRequestContext>>
  ): this | DependentGraph<TRequestContext> {
    if (!others.length) {
      return this;
    }

    const deletions = new Set(this.deletions);
    const upserts = new Set(this.upserts);
    const upsertIfFounds = new Set(this.upsertIfFounds);
    const dependenciesByEdge = new Map(this.dependentsByEdge);
    const dependenciesByReverseEdge = new Map(this.dependentsByReverseEdge);

    for (const other of others) {
      assert.strictEqual(other.path, this.path);
      assert.strictEqual(other.node, this.node);

      other.deletions.forEach((deletion) => deletions.add(deletion));
      other.upserts.forEach((upsert) => upserts.add(upsert));
      other.upsertIfFounds.forEach((upsertIfFound) =>
        upsertIfFounds.add(upsertIfFound),
      );

      other.dependentsByEdge.forEach((dependent, edge) =>
        dependenciesByEdge.set(
          edge,
          dependenciesByEdge.get(edge)?.mergeWith(dependent) ?? dependent,
        ),
      );

      other.dependentsByReverseEdge.forEach((dependent, reverseEdge) =>
        dependenciesByReverseEdge.set(
          reverseEdge,
          dependenciesByReverseEdge.get(reverseEdge)?.mergeWith(dependent) ??
            dependent,
        ),
      );
    }

    return new DependentGraph(
      this.changes,
      this.path ?? this.filter ?? this.node,
      deletions,
      upserts,
      upsertIfFounds,
      dependenciesByEdge.entries(),
      dependenciesByReverseEdge.entries(),
    );
  }

  @MMethod()
  public isEmpty(): boolean {
    return (
      !this.dependents.size &&
      !this.dependentsByEdge.size &&
      !this.dependentsByReverseEdge.size
    );
  }

  @MMethod()
  public toJSON(): DependentGraphJSON {
    return {
      ...(this.upserts.size && {
        upserts: Array.from(this.upserts, ({ stringifiedId }) => stringifiedId),
      }),
      ...(this.upsertIfFounds.size && {
        upsertIfFounds: Array.from(
          this.upsertIfFounds,
          ({ stringifiedId }) => stringifiedId,
        ),
      }),
      ...(this.deletions.size && {
        deletions: Array.from(
          this.deletions,
          ({ stringifiedId }) => stringifiedId,
        ),
      }),
      ...(this.dependentsByEdge.size && {
        dependentsByEdge: Object.fromEntries(
          this.dependentsByEdge
            .entries()
            .map(([{ name }, dependents]) => [name, dependents.toJSON()]),
        ),
      }),
      ...(this.dependentsByReverseEdge.size && {
        dependentsByReverseEdge: Object.fromEntries(
          this.dependentsByReverseEdge
            .entries()
            .map(([{ name }, dependents]) => [name, dependents.toJSON()]),
        ),
      }),
    };
  }

  @MGetter
  public get graphFilter(): NodeFilter {
    if (this.path) {
      const tail = this.path.tail;
      const head = this.path.head;

      if (this.path instanceof Edge) {
        const edge = this.path;

        return new NodeFilter(
          tail,
          EdgeExistsFilter.create(
            edge,
            new NodeFilter(
              head,
              OrOperation.create([
                ...this.dependents
                  .values()
                  .flatMap((change) =>
                    change instanceof NodeCreation
                      ? [
                          edge.referencedUniqueConstraint.createFilterFromValue(
                            change.newValue,
                          ).filter,
                        ]
                      : change instanceof NodeUpdate
                        ? [
                            edge.referencedUniqueConstraint.createFilterFromValue(
                              change.newValue,
                            ).filter,
                            edge.referencedUniqueConstraint.createFilterFromValue(
                              change.oldValue,
                            ).filter,
                          ]
                        : [
                            edge.referencedUniqueConstraint.createFilterFromValue(
                              change.oldValue,
                            ).filter,
                          ],
                  ),
                ...this.dependentsByEdge
                  .values()
                  .map(({ graphFilter: { filter } }) => filter),
                ...this.dependentsByReverseEdge
                  .values()
                  .map(({ graphFilter: { filter } }) => filter),
              ]),
            ),
          ),
        );
      } else {
        const reverseEdge = this.path;
        const originalEdge = reverseEdge.originalEdge;

        const headFilter = new NodeFilter(
          head,
          OrOperation.create([
            ...this.dependentsByEdge
              .values()
              .map(({ graphFilter: { filter } }) => filter),
            ...this.dependentsByReverseEdge
              .values()
              .map(({ graphFilter: { filter } }) => filter),
          ]),
        );

        return new NodeFilter(
          tail,
          OrOperation.create([
            ...this.dependents
              .values()
              .flatMap((change) =>
                change instanceof NodeCreation
                  ? [
                      originalEdge.referencedUniqueConstraint.createFilterFromValue(
                        change.newValue[originalEdge.name],
                      ).filter,
                    ]
                  : change instanceof NodeUpdate
                    ? [
                        originalEdge.referencedUniqueConstraint.createFilterFromValue(
                          change.newValue[originalEdge.name],
                        ).filter,
                        originalEdge.referencedUniqueConstraint.createFilterFromValue(
                          change.oldValue[originalEdge.name],
                        ).filter,
                      ]
                    : [
                        originalEdge.referencedUniqueConstraint.createFilterFromValue(
                          change.oldValue[originalEdge.name],
                        ).filter,
                      ],
              ),
            reverseEdge instanceof UniqueReverseEdge
              ? UniqueReverseEdgeExistsFilter.create(reverseEdge, headFilter)
              : MultipleReverseEdgeExistsFilter.create(reverseEdge, headFilter),
          ]),
        );
      }
    }

    return new NodeFilter(
      this.node,
      OrOperation.create([
        ...this.dependentsByEdge
          .values()
          .map(({ graphFilter: { filter } }) => filter),
        ...this.dependentsByReverseEdge
          .values()
          .map(({ graphFilter: { filter } }) => filter),
      ]),
    );
  }

  @MGetter
  public get count(): Promise<number> {
    return this.node.api
      .count(this.changes, {
        where: {
          OR: [
            ...this.upsertIfFounds.values().map(({ id }) => id),
            this.graphFilter.inputValue,
          ],
        },
      })
      .then((count) => count + this.deletions.size + this.upserts.size);
  }
}
