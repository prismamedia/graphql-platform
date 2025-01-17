import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { ReverseEdgeDependencyGraph } from '../../../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import type { BooleanFilter } from '../../../../boolean.js';
import { NotOperation, type AndOperand } from '../../../operation.js';
import { FalseValue } from '../../../value.js';
import { AbstractReverseEdgeFilter } from '../../abstract-reverse-edge.js';
import { MultipleReverseEdgeExistsFilter } from './exists.js';

export class MultipleReverseEdgeCountFilter extends AbstractReverseEdgeFilter {
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
        return new MultipleReverseEdgeExistsFilter(reverseEdge);
      }
    } else if (operator === 'lt') {
      if (value === 0) {
        return FalseValue;
      } else if (value === 1) {
        return this.create(reverseEdge, 'eq', 0);
      }
    } else if (operator === 'eq') {
      if (value === 0) {
        return new NotOperation(
          new MultipleReverseEdgeExistsFilter(reverseEdge),
        );
      }
    }

    return new this(reverseEdge, operator, value);
  }

  public readonly key: string;
  public readonly score: number;

  protected constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
    public readonly operator: 'eq' | 'gt' | 'lt',
    public readonly value: number,
  ) {
    super(reverseEdge);

    this.key =
      operator === 'eq'
        ? reverseEdge.countFieldName
        : `${reverseEdge.countFieldName}_${operator}`;

    this.score = 2;
  }

  public equals(
    expression: unknown,
  ): expression is MultipleReverseEdgeCountFilter {
    return (
      expression instanceof MultipleReverseEdgeCountFilter &&
      expression.reverseEdge === this.reverseEdge &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  @MGetter
  public override get complement(): BooleanFilter | undefined {
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

  public override and(
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

  public get dependency() {
    return new ReverseEdgeDependencyGraph(this.reverseEdge);
  }

  public get ast(): graphql.ConstObjectValueNode {
    return {
      kind: graphql.Kind.OBJECT,
      fields: [
        {
          kind: graphql.Kind.OBJECT_FIELD,
          name: { kind: graphql.Kind.NAME, value: this.key },
          value: { kind: graphql.Kind.INT, value: String(this.value) },
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: this.value };
  }
}
