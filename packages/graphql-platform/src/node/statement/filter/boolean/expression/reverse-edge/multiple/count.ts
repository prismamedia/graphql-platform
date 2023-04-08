import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../../definition/reverse-edge/multiple.js';
import type { DependencyTree } from '../../../../../../result-set.js';
import { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { BooleanValue } from '../../../value.js';

export interface MultipleReverseEdgeCountFilterAST {
  kind: 'MultipleReverseEdgeCountFilter';
  reverseEdge: MultipleReverseEdge['name'];
  operator: MultipleReverseEdgeCountFilter['operator'];
  value: MultipleReverseEdgeCountFilter['value'];
}

export class MultipleReverseEdgeCountFilter
  implements BooleanExpressionInterface
{
  public readonly operator: 'eq' | 'gt' | 'lt';
  public readonly value: number;
  public readonly reduced: BooleanValue | MultipleReverseEdgeCountFilter | this;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
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
          ? new MultipleReverseEdgeCountFilter(reverseEdge, 'eq', 0)
          : this
        : this;
  }

  public get dependencies(): DependencyTree | undefined {
    return new Map([
      [this.reverseEdge, new Map([[this.reverseEdge.originalEdge, undefined]])],
    ]);
  }

  @Memoize()
  public get complement(): MultipleReverseEdgeCountFilter | undefined {
    return this.operator === 'gt'
      ? new MultipleReverseEdgeCountFilter(this.reverseEdge, 'lte', this.value)
      : this.operator === 'lt'
      ? new MultipleReverseEdgeCountFilter(this.reverseEdge, 'gte', this.value)
      : undefined;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof MultipleReverseEdgeCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof MultipleReverseEdgeCountFilter &&
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

  public get ast(): MultipleReverseEdgeCountFilterAST {
    return {
      kind: 'MultipleReverseEdgeCountFilter',
      reverseEdge: this.reverseEdge.name,
      operator: this.operator,
      value: this.value,
    };
  }

  public execute(_nodeValue: Partial<NodeValue>): undefined {
    return;
  }
}
