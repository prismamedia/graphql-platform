import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { Node, NodeValue } from '../../node.js';
import type { DependencyTree } from '../result-set.js';
import type { BooleanFilter } from './filter/boolean.js';
import { NotOperation } from './filter/boolean/operation/not.js';
import { FalseValue, TrueValue } from './filter/boolean/value.js';

export * from './filter/boolean.js';

export interface NodeFilterAST {
  kind: 'NODE';
  node: Node['name'];
  filter: BooleanFilter['ast'];
}

export class NodeFilter {
  /**
   * Used to sort filters, the lower the better
   */
  public readonly score: number;

  /**
   * List of the components & reverse-edges whom changes may change the result-set
   */
  public readonly dependencies: DependencyTree | undefined;

  public constructor(
    public readonly node: Node,
    public readonly filter: BooleanFilter,
  ) {
    this.score = filter.score;
    this.dependencies = filter.dependencies;
  }

  @Memoize()
  public get complement(): NodeFilter {
    return new NodeFilter(this.node, NotOperation.create(this.filter));
  }

  public equals(nodeFilter: unknown): boolean {
    return (
      nodeFilter instanceof NodeFilter &&
      nodeFilter.node === this.node &&
      nodeFilter.filter.equals(this.filter)
    );
  }

  public isTrue(): boolean {
    return this.filter.equals(TrueValue);
  }

  public isFalse(): boolean {
    return this.filter.equals(FalseValue);
  }

  public get ast(): NodeFilterAST {
    return {
      kind: 'NODE',
      node: this.node.name,
      filter: this.filter.ast,
    };
  }

  public get normalized(): NodeFilter | undefined {
    return this.isTrue() ? undefined : this;
  }

  /**
   * Execute this filter against a partial value, returns undefined if not applicable
   */
  public execute<TPartial extends boolean = true>(
    nodeValue: Partial<NodeValue>,
    partial?: TPartial,
  ): TPartial extends false ? boolean : boolean | undefined {
    const result = this.filter.execute(nodeValue);

    assert(
      result !== undefined || partial !== false,
      'The filter is not applicable to this value',
    );

    return result as any;
  }
}

export const areFiltersEqual = (
  a: NodeFilter | undefined,
  b: NodeFilter | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
