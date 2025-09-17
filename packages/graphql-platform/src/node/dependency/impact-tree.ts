import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import type { NodeChange } from '../change.js';
import type { Edge, ReverseEdge } from '../definition.js';
import { areDependencyPathsEqual, type DependencyPath } from './path.js';

function isReadonlySet<T>(value: unknown): value is ReadonlySet<T> {
  return value instanceof Set;
}

function isReadonlyMap<K, V>(value: unknown): value is ReadonlyMap<K, V> {
  return value instanceof Map;
}

export class ImpactTree<TRequestContext extends object = any> {
  public readonly changes?: ReadonlySet<NodeChange<TRequestContext>>;
  public readonly children?: ReadonlyMap<
    Edge | ReverseEdge,
    ImpactTree<TRequestContext>
  >;

  public readonly normalized?: this;

  public constructor(
    public readonly path: DependencyPath,
    rawChanges?:
      | ReadonlySet<NodeChange<TRequestContext>>
      | Iterable<NodeChange<TRequestContext>>,
    rawChildren?:
      | ReadonlyMap<Edge | ReverseEdge, ImpactTree<TRequestContext>>
      | IteratorObject<
          [Edge | ReverseEdge, ImpactTree<TRequestContext> | undefined]
        >,
  ) {
    const changes = isReadonlySet(rawChanges)
      ? rawChanges
      : new Set(rawChanges);
    this.changes = changes.size ? changes : undefined;

    const children = isReadonlyMap(rawChildren)
      ? rawChildren
      : new Map(
          rawChildren
            ?.map(([key, value]) => [key, value?.normalized])
            .filter(
              (entry): entry is [Edge | ReverseEdge, ImpactTree] =>
                entry[1] !== undefined,
            ),
        );
    this.children = children.size ? children : undefined;

    this.normalized =
      this.changes?.size || this.children?.size ? this : undefined;
  }

  public mergeWith(
    other?: ImpactTree<TRequestContext>,
  ): this | ImpactTree<TRequestContext> {
    if (!other) {
      return this;
    }

    assert(areDependencyPathsEqual(other.path, this.path));

    return new ImpactTree(
      this.path,
      this.changes?.size && other.changes?.size
        ? this.changes.union(other.changes)
        : this.changes || other.changes,
      this.children?.size && other.children?.size
        ? [
            ...this.children
              .entries()
              .map(([key, value]): [Edge | ReverseEdge, ImpactTree] => [
                key,
                value.mergeWith(other.children!.get(key)),
              ]),
            ...other.children
              .entries()
              .filter(([key]) => !this.children!.has(key)),
          ].values()
        : this.children || other.children,
    );
  }

  public toJSON(): JsonObject {
    return {
      ...(this.changes?.size && {
        changes: Object.fromEntries(
          Map.groupBy(this.changes, ({ kind }) => kind)
            .entries()
            .map(([type, changes]) => [type, changes.length]),
        ),
      }),
      ...(this.children?.size && {
        children: Object.fromEntries(
          this.children
            .entries()
            .map(([{ name }, child]) => [name, child.toJSON()]),
        ),
      }),
    };
  }
}
