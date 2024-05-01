import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Node, NodeValue, UniqueConstraint } from '../../node.js';
import type { NodeChange, NodeUpdate } from '../change.js';
import type { NodeFilterInputValue } from '../type.js';
import type { BooleanFilter } from './filter/boolean.js';
import {
  AndOperation,
  NotOperation,
  OrOperation,
} from './filter/boolean/operation.js';
import { FalseValue, TrueValue } from './filter/boolean/value.js';
import type { NodeSelectedValue } from './selection.js';

export * from './filter/boolean.js';

export class NodeFilter {
  /**
   * Used to sort filters, the lower the better/simpler
   */
  public readonly score: number;

  public constructor(
    public readonly node: Node,
    public readonly filter: BooleanFilter,
  ) {
    this.score = filter.score;
  }

  @Memoize()
  public get complement(): NodeFilter {
    return new NodeFilter(this.node, NotOperation.create(this.filter));
  }

  public and(...others: ReadonlyArray<NodeFilter>): NodeFilter | this {
    return others.length
      ? new NodeFilter(
          this.node,
          AndOperation.create([
            this.filter,
            ...others.map((other) => {
              assert.equal(other.node, this.node);

              return other.filter;
            }),
          ]),
        )
      : this;
  }

  public or(...others: ReadonlyArray<NodeFilter>): NodeFilter | this {
    return others.length
      ? new NodeFilter(
          this.node,
          OrOperation.create([
            this.filter,
            ...others.map((other) => {
              assert.equal(other.node, this.node);

              return other.filter;
            }),
          ]),
        )
      : this;
  }

  public equals(filter: unknown): boolean {
    return (
      filter instanceof NodeFilter &&
      filter.node === this.node &&
      filter.filter.equals(this.filter)
    );
  }

  @Memoize()
  public isTrue(): boolean {
    return this.filter.equals(TrueValue);
  }

  @Memoize()
  public isFalse(): boolean {
    return this.filter.equals(FalseValue);
  }

  @Memoize()
  public get normalized(): NodeFilter | undefined {
    return this.isTrue() ? undefined : this;
  }

  /**
   * Execute this filter against a partial value, returns undefined if not applicable
   */
  public execute<TPartial extends boolean>(
    value: NodeSelectedValue,
    partial: TPartial,
  ): TPartial extends false ? boolean : boolean | undefined {
    const result = this.filter.execute(value);

    if (partial === false) {
      assert.notEqual(
        result,
        undefined,
        'The filter is not applicable to this value',
      );
    }

    return result as any;
  }

  /**
   * Is the provided unique-constraint's value enough to execute this filter?
   */
  public isExecutableWithinUniqueConstraint(unique: UniqueConstraint): boolean {
    assert.equal(unique.node, this.node);

    return this.filter.isExecutableWithinUniqueConstraint(unique);
  }

  /**
   * Is the provided node-update affecting this filter?
   */
  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    assert.equal(update.node, this.node);

    return this.filter.isAffectedByNodeUpdate(update);
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): NodeFilter | null {
    const filter = this.filter.getAffectedGraphByNodeChange(
      change,
      visitedRootNodes,
    );

    return filter && !filter.equals(FalseValue)
      ? new NodeFilter(this.node, filter)
      : null;
  }

  @Memoize()
  public isUnique(): boolean {
    return this.node.uniqueFilterInputType.isValid(this.inputValue);
  }

  @Memoize()
  public get ast(): graphql.ConstObjectValueNode | graphql.NullValueNode {
    return this.filter.ast;
  }

  @Memoize()
  public toString(): string {
    return graphql.print(this.ast);
  }

  @Memoize()
  public get inputValue(): Exclude<NodeFilterInputValue, undefined> {
    return this.filter.inputValue;
  }
}

export const areFiltersEqual = (
  a: NodeFilter | undefined,
  b: NodeFilter | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
