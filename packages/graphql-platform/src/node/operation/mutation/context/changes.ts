import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import * as R from 'remeda';
import type { Node } from '../../../../node.js';
import type { NodeChange } from '../../../change.js';
import { MutationContextChangesByNode } from './changes/by-node.js';

export * from './changes/by-node.js';

export interface MutationContextChangesConfig {
  /**
   * Optional, limit the number of changes in the aggregation
   *
   * @default undefined (= Infinity)
   */
  maxSize?: number;

  /**
   * Optional, what to do when the max size is reached
   *
   * @default 'error'
   */
  onMaxSizeReached?: 'error' | 'ignore';
}

export class MutationContextChanges<TRequestContext extends object = any>
  implements Iterable<NodeChange<TRequestContext>>, Disposable
{
  public readonly requestContext: TRequestContext;
  public committedAt?: Date;

  public readonly changesByNode: Map<
    Node,
    MutationContextChangesByNode<TRequestContext>
  >;

  public readonly maxSize?: number;
  public readonly onMaxSizeReached: 'error' | 'ignore';

  public constructor(
    requestContext?: TRequestContext,
    changes?: ReadonlyArray<NodeChange<TRequestContext>>,
    configOrMaxSize?:
      | MutationContextChangesConfig
      | MutationContextChangesConfig['maxSize'],
  ) {
    if (requestContext) {
      this.requestContext = requestContext;
    } else {
      const change = changes?.[0];
      assert(change, 'Either a request-context is provided or a change');

      this.requestContext = change.requestContext;
    }

    const config =
      typeof configOrMaxSize === 'number'
        ? { maxSize: configOrMaxSize }
        : configOrMaxSize;

    this.maxSize = config?.maxSize ?? undefined;
    this.onMaxSizeReached = config?.onMaxSizeReached ?? 'error';

    this.changesByNode = new Map();
    changes && this.add(...changes);
  }

  public add(...changes: ReadonlyArray<NodeChange<TRequestContext>>): this {
    if (changes.length) {
      if (this.isEmpty()) {
        this.committedAt = changes[0].committedAt;
      }

      for (const change of changes) {
        assert.strictEqual(
          change.requestContext,
          this.requestContext,
          'Changes must share the same request-context',
        );
        assert.strictEqual(
          change.committedAt,
          this.committedAt,
          'Changes must share the same commit',
        );

        let aggregation = this.changesByNode.get(change.node);
        if (!aggregation) {
          this.changesByNode.set(
            change.node,
            (aggregation = new MutationContextChangesByNode(this, change.node)),
          );
        }

        aggregation.add(change);
      }

      this.changesByNode.forEach(
        (changes) =>
          changes.isEmpty() && this.changesByNode.delete(changes.node),
      );
    }

    return this;
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const changes of this.changesByNode.values()) {
      yield* changes;
    }
  }

  public [Symbol.dispose](): void {
    this.changesByNode.forEach((changes) => changes[Symbol.dispose]());
    this.changesByNode.clear();
  }

  public commit(at: Date = new Date()): void {
    this.changesByNode.forEach((changes) => changes.commit(at));
    this.committedAt = at;
  }

  public get size(): number {
    return this.changesByNode.values().reduce((sum, { size }) => sum + size, 0);
  }

  public isEmpty(): boolean {
    return this.changesByNode.values().every((changes) => changes.isEmpty());
  }

  public toJSON(): Record<
    Node['name'],
    Partial<Record<utils.MutationType, number>>
  > {
    return Object.fromEntries(
      this.changesByNode.values().map((changes) => [
        changes.node.name,
        R.pipe(
          utils.mutationTypes,
          R.filter((type) => changes[type].size > 0),
          R.mapToObj((type) => [type, changes[type].size]),
        ),
      ]),
    );
  }
}
