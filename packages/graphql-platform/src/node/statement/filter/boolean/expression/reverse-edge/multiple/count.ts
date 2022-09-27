import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../../../definition/reverse-edge/multiple.js';
import { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { BooleanValue } from '../../../value.js';

export interface ReverseEdgeMultipleCountFilterAST {
  kind: 'ReverseEdgeMultipleCountFilter';
  reverseEdge: ReverseEdgeMultiple['name'];
  operator: ReverseEdgeMultipleCountFilter['operator'];
  value: ReverseEdgeMultipleCountFilter['value'];
}

export class ReverseEdgeMultipleCountFilter
  implements BooleanExpressionInterface
{
  public readonly operator: 'eq' | 'gt' | 'lt';
  public readonly value: number;
  public readonly reduced: BooleanValue | ReverseEdgeMultipleCountFilter | this;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte',
    value: number,
  ) {
    assert(
      Number.isInteger(value) && value >= 0,
      `Expects a non-negative integer, got: ${value}`,
    );

    switch (operator) {
      case 'gte':
        this.operator = 'gt';
        this.value = value - 1;
        break;

      case 'lte':
        this.operator = 'lt';
        this.value = value + 1;
        break;

      default:
        this.operator = operator;
        this.value = value;
        break;
    }

    this.reduced =
      this.operator === 'lt'
        ? this.value === 0
          ? new BooleanValue(false)
          : this.value === 1
          ? new ReverseEdgeMultipleCountFilter(reverseEdge, 'eq', 0)
          : this
        : this;
  }

  @Memoize()
  public get complement(): ReverseEdgeMultipleCountFilter | undefined {
    return this.operator === 'gt'
      ? new ReverseEdgeMultipleCountFilter(this.reverseEdge, 'lte', this.value)
      : this.operator === 'lt'
      ? new ReverseEdgeMultipleCountFilter(this.reverseEdge, 'gte', this.value)
      : undefined;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof ReverseEdgeMultipleCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof ReverseEdgeMultipleCountFilter &&
      expression.reverseEdge === this.reverseEdge
    ) {
      if (
        this.operator === 'eq' &&
        expression.operator === 'eq' &&
        this.value !== expression.value
      ) {
        return new BooleanValue(false);
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
      operator: this.operator,
      value: this.value,
    };
  }
}
