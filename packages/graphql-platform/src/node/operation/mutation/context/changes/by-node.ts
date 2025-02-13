import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { Node } from '../../../../../node.js';
import type {
  NodeChange,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../../../change.js';
import { isActualNodeChange } from '../../../../change.js';
import type { MutationContextChanges } from '../changes.js';

export class MutationContextChangesByNode<TRequestContext extends object = any>
  implements Iterable<NodeChange<TRequestContext>>, Disposable
{
  public readonly [utils.MutationType.CREATION] = new Map<
    NodeChange['stringifiedId'],
    NodeCreation<TRequestContext>
  >();

  public readonly [utils.MutationType.UPDATE] = new Map<
    NodeChange['stringifiedId'],
    NodeUpdate<TRequestContext>
  >();

  public readonly [utils.MutationType.DELETION] = new Map<
    NodeChange['stringifiedId'],
    NodeDeletion<TRequestContext>
  >();

  public constructor(
    public readonly parent: MutationContextChanges<TRequestContext>,
    public readonly node: Node,
  ) {}

  public add(change: NodeChange<TRequestContext>): void {
    assert.equal(change.node, this.node);
    if (!isActualNodeChange(change)) {
      return;
    }

    const previousChange =
      this[utils.MutationType.CREATION].get(change.stringifiedId) ??
      this[utils.MutationType.UPDATE].get(change.stringifiedId) ??
      this[utils.MutationType.DELETION].get(change.stringifiedId);

    if (!previousChange) {
      if (
        this.parent.maxSize !== undefined &&
        this.parent.maxSize <= this.size
      ) {
        if (this.parent.onMaxSizeReached === 'error') {
          throw new Error(
            `The maximum number of changes, ${this.parent.maxSize}, has been reached`,
          );
        }

        return;
      }

      this[change.kind].set(change.stringifiedId, change as any);
    } else if (previousChange.executedAt <= change.executedAt) {
      this[previousChange.kind].delete(previousChange.stringifiedId);

      const aggregate = previousChange.mergeWith(change);
      if (aggregate) {
        this[aggregate.kind].set(aggregate.stringifiedId, aggregate as any);
      }
    }
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const type of utils.mutationTypes) {
      yield* this[type].values();
    }
  }

  public [Symbol.dispose](): void {
    utils.mutationTypes.forEach((type) => this[type].clear());
  }

  public commit(at: Date = new Date()): void {
    utils.mutationTypes.forEach((type) =>
      this[type].forEach((change) => (change.committedAt = at)),
    );
  }

  public get size(): number {
    return utils.mutationTypes.reduce((sum, type) => sum + this[type].size, 0);
  }

  public isEmpty(): boolean {
    return utils.mutationTypes.every((type) => this[type].size === 0);
  }
}
