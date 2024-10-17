import * as utils from '@prismamedia/graphql-platform-utils';
import type { Node } from '../../node.js';
import {
  isActualNodeChange,
  NodeCreation,
  NodeUpdate,
  type NodeChange,
} from '../change.js';
import { NodeChangeAggregationSummary } from './aggregation/summary.js';

export * from './aggregation/summary.js';

type NodeChangeAggregatorMatrix = {
  [TPreviousChangeKind in utils.MutationType]: {
    [TChangeKind in utils.MutationType]: (
      previousChange: Extract<NodeChange, { kind: TPreviousChangeKind }>,
      change: Extract<NodeChange, { kind: TChangeKind }>,
    ) => NodeChange | void;
  };
};

/**
 * A case that should not happen, we missed something.
 * We could throw an error, but let's keep the new change instead.
 */
const invalidAggregator = (_previousChange: NodeChange, change: NodeChange) =>
  change;

const aggregatorMatrix: NodeChangeAggregatorMatrix = {
  [utils.MutationType.CREATION]: {
    [utils.MutationType.CREATION]: invalidAggregator,

    [utils.MutationType.UPDATE]: (_previousCreation, update) =>
      new NodeCreation(
        update.node,
        update.requestContext,
        update.newValue,
        update.executedAt,
        update.committedAt,
      ),

    [utils.MutationType.DELETION]: (_previousCreation, _deletion) =>
      // This "deletion" cancels the previous "creation" => no change
      undefined,
  },
  [utils.MutationType.UPDATE]: {
    [utils.MutationType.CREATION]: invalidAggregator,

    [utils.MutationType.UPDATE]: (previousUpdate, update) =>
      new NodeUpdate(
        update.node,
        update.requestContext,
        previousUpdate.oldValue,
        update.newValue,
        update.executedAt,
        update.committedAt,
      ),

    [utils.MutationType.DELETION]: (_previousUpdate, deletion) => deletion,
  },
  [utils.MutationType.DELETION]: {
    [utils.MutationType.CREATION]: (previousDeletion, creation) =>
      new NodeUpdate(
        creation.node,
        creation.requestContext,
        previousDeletion.oldValue,
        creation.newValue,
        creation.executedAt,
        creation.committedAt,
      ),

    [utils.MutationType.UPDATE]: invalidAggregator,
    [utils.MutationType.DELETION]: invalidAggregator,
  },
};

export interface NodeChangeAggregationConfig {
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

export class NodeChangeAggregation<TRequestContext extends object = any>
  implements Iterable<NodeChange<TRequestContext>>, Disposable
{
  public readonly config?: NodeChangeAggregationConfig;

  readonly #maxSize?: number;
  readonly #onMaxSizeReached: 'error' | 'ignore';

  public readonly changesByNode: Map<
    Node,
    Map<NodeChange['stringifiedId'], NodeChange>
  >;

  public constructor(
    configOrMaxSize?:
      | NodeChangeAggregationConfig
      | NodeChangeAggregationConfig['maxSize'],
  ) {
    this.config =
      typeof configOrMaxSize === 'number'
        ? { maxSize: configOrMaxSize }
        : configOrMaxSize;

    this.#maxSize = this.config?.maxSize ?? undefined;
    this.#onMaxSizeReached = this.config?.onMaxSizeReached ?? 'error';

    this.changesByNode = new Map();
  }

  public [Symbol.dispose](): void {
    this.changesByNode.forEach((changes) => changes.clear());
    this.changesByNode.clear();
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const changesByStringifiedId of this.changesByNode.values()) {
      yield* changesByStringifiedId.values();
    }
  }

  public append(...changes: ReadonlyArray<NodeChange<TRequestContext>>): this {
    let currentSize = this.size;

    for (const change of changes) {
      if (!isActualNodeChange(change)) {
        continue;
      }

      let changes = this.changesByNode.get(change.node);
      if (!changes) {
        this.changesByNode.set(change.node, (changes = new Map()));
      }

      const previousChange = changes.get(change.stringifiedId);
      if (!previousChange) {
        if (this.#maxSize !== undefined && currentSize >= this.#maxSize) {
          if (this.#onMaxSizeReached === 'error') {
            throw new Error(
              `The maximum number of changes, ${this.#maxSize}, has been reached`,
            );
          }

          break;
        }

        changes.set(change.stringifiedId, change);
        currentSize++;
      } else if (previousChange.at <= change.at) {
        const aggregate = aggregatorMatrix[previousChange.kind][change.kind](
          previousChange as any,
          change as any,
        );

        if (aggregate && isActualNodeChange(aggregate)) {
          changes.delete(previousChange.stringifiedId);
          changes.set(aggregate.stringifiedId, aggregate);
        } else {
          if (
            changes.delete(previousChange.stringifiedId) &&
            changes.size === 0
          ) {
            this.changesByNode.delete(previousChange.node);
          }
          currentSize--;
        }
      }
    }

    return this;
  }

  public commit(at: Date = new Date()): void {
    for (const change of this) {
      change.committedAt = at;
    }
  }

  public get summary(): NodeChangeAggregationSummary {
    return new NodeChangeAggregationSummary(this);
  }

  public get size(): number {
    return Array.from(
      this.changesByNode.values(),
      (changesByStringifiedId) => changesByStringifiedId.size,
    ).reduce((sum, size) => sum + size, 0);
  }

  /**
   * Creates a shallow copy
   */
  public clone(
    config: NodeChangeAggregationConfig | undefined = this.config,
  ): NodeChangeAggregation<TRequestContext> {
    return new NodeChangeAggregation(config).append(...this);
  }
}
