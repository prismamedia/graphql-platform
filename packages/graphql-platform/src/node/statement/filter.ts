import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { Node } from '../../node.js';
import type { DependencyGraph } from '../operation.js';
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

export interface NodeFilterAST {
  kind: 'NODE';
  node: Node['name'];
  filter: BooleanFilter['ast'];
}

export class NodeFilter {
  /**
   * Used to sort filters, the lower the better/simpler
   */
  public readonly score: number;

  /**
   * Used in subscriptions to know wich nodes to fetch
   */
  public readonly dependencies?: DependencyGraph;
  public readonly useGraph: boolean;

  public constructor(
    public readonly node: Node,
    public readonly filter: BooleanFilter,
  ) {
    this.score = filter.score;
    this.dependencies = filter.dependencies;
    this.useGraph = this.dependencies?.children
      ? this.dependencies?.children.size > 0
      : false;
  }

  @Memoize()
  public get complement(): NodeFilter {
    return new NodeFilter(this.node, NotOperation.create(this.filter));
  }

  public and(other: NodeFilter): NodeFilter {
    assert.equal(other.node, this.node);

    return new NodeFilter(
      this.node,
      AndOperation.create([this.filter, other.filter]),
    );
  }

  public or(other: NodeFilter): NodeFilter {
    assert.equal(other.node, this.node);

    return new NodeFilter(
      this.node,
      OrOperation.create([this.filter, other.filter]),
    );
  }

  public equals(filter: unknown): boolean {
    return (
      filter instanceof NodeFilter &&
      filter.node === this.node &&
      filter.filter.equals(this.filter)
    );
  }

  public isTrue(): boolean {
    return this.filter.equals(TrueValue);
  }

  public isFalse(): boolean {
    return this.filter.equals(FalseValue);
  }

  public isUnique(): boolean {
    return this.node.uniqueFilterInputType.isValid(this.inputValue);
  }

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

  public get ast(): NodeFilterAST {
    return {
      kind: 'NODE',
      node: this.node.name,
      filter: this.filter.ast,
    };
  }

  @Memoize()
  public get inputValue(): NodeFilterInputValue {
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
