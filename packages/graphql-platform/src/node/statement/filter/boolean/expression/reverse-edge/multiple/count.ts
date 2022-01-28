import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, type NodeFilter } from '../../../../../filter.js';
import { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { BooleanValue } from '../../../value.js';

export interface ReverseEdgeMultipleCountFilterAST {
  kind: 'ReverseEdgeMultipleCountFilter';
  reverseEdge: ReverseEdgeMultiple['name'];
  headFilter?: NodeFilter['ast'];
  operator: ReverseEdgeMultipleCountFilter['operator'];
  value: ReverseEdgeMultipleCountFilter['value'];
}

export class ReverseEdgeMultipleCountFilter
  implements BooleanExpressionInterface
{
  public readonly headFilter?: NodeFilter;
  public readonly reduced: BooleanValue | ReverseEdgeMultipleCountFilter | this;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    headFilter: NodeFilter | undefined,
    public readonly operator: 'eq' | 'not' | 'gt' | 'gte' | 'lt' | 'lte',
    public readonly value: number,
  ) {
    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }

    assert(
      Number.isInteger(value) && value >= 0,
      `Expects a non-negative integer, got: ${value}`,
    );

    this.reduced =
      operator === 'lt'
        ? value === 0
          ? new BooleanValue(false)
          : value === 1
          ? new ReverseEdgeMultipleCountFilter(
              reverseEdge,
              this.headFilter,
              'eq',
              0,
            )
          : this
        : operator === 'lte'
        ? value === 0
          ? new ReverseEdgeMultipleCountFilter(
              reverseEdge,
              this.headFilter,
              'eq',
              0,
            )
          : this
        : this;
  }

  @Memoize()
  public get complement(): ReverseEdgeMultipleCountFilter {
    return new ReverseEdgeMultipleCountFilter(
      this.reverseEdge,
      this.headFilter,
      this.operator === 'eq'
        ? 'not'
        : this.operator === 'not'
        ? 'eq'
        : this.operator === 'gt'
        ? 'lte'
        : this.operator === 'gte'
        ? 'lt'
        : this.operator === 'lt'
        ? 'gte'
        : 'gt',
      this.value,
    );
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof ReverseEdgeMultipleCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter) &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof ReverseEdgeMultipleCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    ) {
      if (this.operator === 'eq') {
        if (expression.operator === 'eq') {
          if (this.value !== expression.value) {
            return new BooleanValue(false);
          }
        } else if (expression.operator === 'not') {
          if (this.value === expression.value) {
            return new BooleanValue(false);
          }
        }
      }
    }
  }

  public or(expression: unknown): BooleanFilter | undefined {
    return undefined;
  }

  public get ast(): ReverseEdgeMultipleCountFilterAST {
    return {
      kind: 'ReverseEdgeMultipleCountFilter',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
      operator: this.operator,
      value: this.value,
    };
  }
}
