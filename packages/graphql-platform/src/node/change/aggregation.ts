import * as utils from '@prismamedia/graphql-platform-utils';
import * as R from 'remeda';
import type { Node } from '../../node.js';
import type { NodeChange } from '../change.js';
import { NodeChangeAggregationByNode } from './aggregation/by-node.js';

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
  public readonly maxSize?: number;
  public readonly onMaxSizeReached: 'error' | 'ignore';
  public readonly changesByNode: Map<
    Node,
    NodeChangeAggregationByNode<TRequestContext>
  >;

  public constructor(
    changes?: Iterable<NodeChange<TRequestContext>>,
    configOrMaxSize?:
      | NodeChangeAggregationConfig
      | NodeChangeAggregationConfig['maxSize'],
  ) {
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
      for (const change of changes) {
        let aggregation = this.changesByNode.get(change.node);
        if (!aggregation) {
          this.changesByNode.set(
            change.node,
            (aggregation = new NodeChangeAggregationByNode(this, change.node)),
          );
        }

        aggregation.add(change);
      }

      this.changesByNode.forEach(
        (aggregation) =>
          aggregation.isEmpty() && this.changesByNode.delete(aggregation.node),
      );
    }

    return this;
  }

  public *[Symbol.iterator](): IterableIterator<NodeChange<TRequestContext>> {
    for (const aggregation of this.changesByNode.values()) {
      yield* aggregation;
    }
  }

  public [Symbol.dispose](): void {
    this.changesByNode.forEach((aggregation) => aggregation[Symbol.dispose]());
    this.changesByNode.clear();
  }

  public commit(at: Date = new Date()): void {
    this.changesByNode
      .values()
      .forEach((aggregation) => aggregation.commit(at));
  }

  public get size(): number {
    return this.changesByNode.values().reduce((sum, { size }) => sum + size, 0);
  }

  public isEmpty(): boolean {
    return this.changesByNode
      .values()
      .every((aggregation) => aggregation.isEmpty());
  }

  public toJSON(): Record<
    Node['name'],
    Partial<Record<utils.MutationType, number>>
  > {
    return Object.fromEntries(
      this.changesByNode.values().map((aggregation) => [
        aggregation.node.name,
        R.pipe(
          utils.mutationTypes,
          R.filter((type) => aggregation[type].size > 0),
          R.mapToObj((type) => [type, aggregation[type].size]),
        ),
      ]),
    );
  }
}
