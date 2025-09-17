import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import { Node } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  type NodeChange,
  type NodeUpdate,
} from '../change.js';
import { Edge } from '../definition/component.js';
import {
  UniqueReverseEdge,
  type ReverseEdge,
} from '../definition/reverse-edge.js';
import type { MutationContextChanges } from '../operation.js';
import {
  AndOperation,
  EdgeExistsFilter,
  FalseValue,
  MultipleReverseEdgeExistsFilter,
  NodeFilter,
  OrOperation,
  TrueValue,
  UniqueReverseEdgeExistsFilter,
} from '../statement/filter.js';
import { areDependencyPathsEqual, type DependencyPath } from './path.js';

export class DependentNode<TRequestContext extends object = any> {
  public readonly hits: ReadonlySet<NodeChange<TRequestContext>>;
  public readonly children: ReadonlyMap<
    Edge | ReverseEdge,
    DependentNode<TRequestContext>
  >;

  public readonly normalized?: this;

  public constructor(
    public readonly path: DependencyPath,
    rawHits?: Iterable<NodeChange<TRequestContext>>,
    rawChildren?: Iterable<
      [Edge | ReverseEdge, DependentNode<TRequestContext> | undefined]
    >,
  ) {
    this.hits = new Set(rawHits);
    this.children = new Map(
      rawChildren
        ? Iterator.from(rawChildren)
            .map(([key, value]) => [key, value?.normalized])
            .filter(
              (entry): entry is [Edge | ReverseEdge, DependentNode] =>
                entry[1] !== undefined,
            )
        : undefined,
    );

    this.normalized = this.hits.size || this.children.size ? this : undefined;
  }

  public mergeWith(
    other?: DependentNode<TRequestContext>,
  ): this | DependentNode<TRequestContext> {
    if (!other) {
      return this;
    }

    assert(areDependencyPathsEqual(other.path, this.path));

    return new DependentNode(this.path, this.hits.union(other.hits), [
      ...this.children
        .entries()
        .map(([key, value]): [Edge | ReverseEdge, DependentNode] => [
          key,
          value.mergeWith(other.children.get(key)),
        ]),
      ...other.children.entries().filter(([key]) => !this.children.has(key)),
    ]);
  }

  public toJSON(): JsonObject {
    return {
      ...(this.hits.size && {
        changes: Object.fromEntries(
          Map.groupBy(this.hits, ({ kind }) => kind)
            .entries()
            .map(([type, changes]) => [type, changes.length]),
        ),
      }),
      ...(this.children.size && {
        children: Object.fromEntries(
          this.children
            .entries()
            .map(([{ name }, child]) => [name, child.toJSON()]),
        ),
      }),
    };
  }

  public get graphFilter(): NodeFilter {
    const currentLevel = this.path.at(-1)!;

    if (currentLevel instanceof Node) {
      return new NodeFilter(
        currentLevel,
        OrOperation.create(
          Array.from(
            this.children.values(),
            (child) => child.graphFilter.filter,
          ),
        ),
      );
    } else if (currentLevel instanceof Edge) {
      return new NodeFilter(
        currentLevel.tail,
        EdgeExistsFilter.create(
          currentLevel,
          new NodeFilter(
            currentLevel.head,
            OrOperation.create([
              ...this.hits
                .values()
                .flatMap((change) =>
                  change instanceof NodeCreation
                    ? [
                        currentLevel.referencedUniqueConstraint.createFilterFromValue(
                          change.newValue,
                        ).filter,
                      ]
                    : change instanceof NodeDeletion
                      ? [
                          currentLevel.referencedUniqueConstraint.createFilterFromValue(
                            change.oldValue,
                          ).filter,
                        ]
                      : [
                          currentLevel.referencedUniqueConstraint.createFilterFromValue(
                            change.newValue,
                          ).filter,
                          currentLevel.referencedUniqueConstraint.createFilterFromValue(
                            change.oldValue,
                          ).filter,
                        ],
                ),
              ...this.children
                .values()
                .map((child) => child.graphFilter.filter),
            ]),
          ),
        ),
      );
    } else {
      const headFilter = new NodeFilter(
        currentLevel.head,
        OrOperation.create(
          Array.from(
            this.children.values(),
            (child) => child.graphFilter.filter,
          ),
        ),
      );

      return new NodeFilter(
        currentLevel.tail,
        OrOperation.create([
          ...this.hits
            .values()
            .flatMap((change) =>
              change instanceof NodeCreation
                ? [
                    currentLevel.originalEdge.referencedUniqueConstraint.createFilterFromValue(
                      change.newValue[currentLevel.originalEdge.name],
                    ).filter,
                  ]
                : change instanceof NodeDeletion
                  ? [
                      currentLevel.originalEdge.referencedUniqueConstraint.createFilterFromValue(
                        change.oldValue[currentLevel.originalEdge.name],
                      ).filter,
                    ]
                  : [
                      currentLevel.originalEdge.referencedUniqueConstraint.createFilterFromValue(
                        change.newValue[currentLevel.originalEdge.name],
                      ).filter,
                      currentLevel.originalEdge.referencedUniqueConstraint.createFilterFromValue(
                        change.oldValue[currentLevel.originalEdge.name],
                      ).filter,
                    ],
            ),
          currentLevel instanceof UniqueReverseEdge
            ? UniqueReverseEdgeExistsFilter.create(currentLevel, headFilter)
            : MultipleReverseEdgeExistsFilter.create(currentLevel, headFilter),
        ]),
      );
    }
  }
}

export class DependentGraph<
  TRequestContext extends object = any,
> extends DependentNode<TRequestContext> {
  public readonly node: Node;

  public readonly deletionFilter: NodeFilter;
  public readonly upsertFilter: NodeFilter;

  public constructor(
    public readonly changes: MutationContextChanges<TRequestContext>,
    path: DependencyPath,
    filter: NodeFilter | undefined,
    public readonly deletions: ReadonlySet<
      NodeDeletion<TRequestContext> | NodeUpdate<TRequestContext>
    >,
    deletionOrUpserts: ReadonlySet<NodeUpdate<TRequestContext>>,
    upserts: ReadonlySet<
      NodeCreation<TRequestContext> | NodeUpdate<TRequestContext>
    >,
    rawChildren?: Iterable<
      [Edge | ReverseEdge, DependentNode<TRequestContext> | undefined]
    >,
  ) {
    super(path, deletions.union(deletionOrUpserts).union(upserts), rawChildren);

    this.node = path[0];

    this.deletionFilter = new NodeFilter(
      this.node,
      filter
        ? AndOperation.create([
            filter.complement.filter,
            OrOperation.create([
              // Deletions are "passed-through" as they cannot be fetch anymore
              // ...this.deletions
              //   .values()
              //   .map(({ node, id }) => node.filterInputType.filter(id).filter),
              ...deletionOrUpserts
                .values()
                .map(({ node, id }) => node.filterInputType.filter(id).filter),
              filter.dependencyTree.createDependentGraph(changes)?.graphFilter
                .filter ?? FalseValue,
            ]),
          ])
        : FalseValue,
    );

    this.upsertFilter = new NodeFilter(
      this.node,
      AndOperation.create([
        filter?.filter ?? TrueValue,
        OrOperation.create([
          ...upserts
            .values()
            .map(({ node, id }) => node.filterInputType.filter(id).filter),
          ...deletionOrUpserts
            .values()
            .map(({ node, id }) => node.filterInputType.filter(id).filter),
          this.graphFilter.filter,
        ]),
      ]),
    );
  }
}
