import { Memoize } from '@prismamedia/memoize';
import type { NodeSelectedValue } from '../../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../../definition/reverse-edge/multiple.js';
import { DependencyGraph } from '../../../../../../subscription.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import {
  NotOperation,
  type AndOperand,
  type OrOperand,
} from '../../../operation.js';
import { FalseValue } from '../../../value.js';
import { MultipleReverseEdgeExistsFilter } from './exists.js';

export interface MultipleReverseEdgeCountFilterAST {
  kind: 'MULTIPLE_REVERSE_EDGE_COUNT';
  reverseEdge: MultipleReverseEdge['name'];
  operator: Uppercase<MultipleReverseEdgeCountFilter['operator']>;
  value: MultipleReverseEdgeCountFilter['value'];
}

export class MultipleReverseEdgeCountFilter
  implements BooleanExpressionInterface
{
  public static create(
    reverseEdge: MultipleReverseEdge,
    operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte',
    value: number,
  ): BooleanFilter {
    if (operator === 'gte') {
      return this.create(reverseEdge, 'gt', value - 1);
    } else if (operator === 'lte') {
      return this.create(reverseEdge, 'lt', value + 1);
    }

    if (operator === 'gt') {
      if (value === 0) {
        return MultipleReverseEdgeExistsFilter.create(reverseEdge);
      }
    } else if (operator === 'lt') {
      if (value === 0) {
        return FalseValue;
      } else if (value === 1) {
        return this.create(reverseEdge, 'eq', 0);
      }
    } else if (operator === 'eq') {
      if (value === 0) {
        return NotOperation.create(
          MultipleReverseEdgeExistsFilter.create(reverseEdge),
        );
      }
    }

    return new this(reverseEdge, operator, value);
  }

  public readonly key: string;

  public readonly score: number;
  public readonly dependencies: DependencyGraph;

  protected constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly operator: 'eq' | 'gt' | 'lt',
    public readonly value: number,
  ) {
    this.key =
      operator === 'eq'
        ? reverseEdge.countFieldName
        : `${reverseEdge.countFieldName}_${operator}`;

    this.score = 2;
    this.dependencies = DependencyGraph.fromReverseEdge(reverseEdge);
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof MultipleReverseEdgeCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  @Memoize()
  public get complement(): BooleanFilter | undefined {
    return this.operator === 'gt'
      ? MultipleReverseEdgeCountFilter.create(
          this.reverseEdge,
          'lte',
          this.value,
        )
      : this.operator === 'lt'
      ? MultipleReverseEdgeCountFilter.create(
          this.reverseEdge,
          'gte',
          this.value,
        )
      : undefined;
  }

  public and(
    operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeCountFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      if (
        this.operator === 'eq' &&
        operand.operator === 'eq' &&
        this.value !== operand.value
      ) {
        return FalseValue;
      }
    }
  }

  public or(
    _operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    return;
  }

  public execute(_value: NodeSelectedValue): undefined {
    return;
  }

  public get ast(): MultipleReverseEdgeCountFilterAST {
    return {
      kind: 'MULTIPLE_REVERSE_EDGE_COUNT',
      reverseEdge: this.reverseEdge.name,
      operator: this.operator.toUpperCase() as any,
      value: this.value,
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.value };
  }
}
