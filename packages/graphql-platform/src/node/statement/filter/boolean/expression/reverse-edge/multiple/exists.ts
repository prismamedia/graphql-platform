import assert from 'node:assert/strict';
import {
  DependencyGraph,
  type NodeSelectedValue,
} from '../../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';

export interface MultipleReverseEdgeExistsFilterAST {
  kind: 'MULTIPLE_REVERSE_EDGE_EXISTS';
  reverseEdge: MultipleReverseEdge['name'];
  headFilter?: NodeFilter['ast'];
}

export class MultipleReverseEdgeExistsFilter
  implements BooleanExpressionInterface
{
  public static create(
    reverseEdge: MultipleReverseEdge,
    headFilter?: NodeFilter,
  ): BooleanFilter {
    headFilter && assert.equal(reverseEdge.head, headFilter.node);

    return headFilter?.isFalse()
      ? FalseValue
      : new this(reverseEdge, headFilter?.normalized);
  }

  public readonly key: string;

  public readonly score: number;
  public readonly dependencies: DependencyGraph;

  protected constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.key = `${reverseEdge.name}_some`;

    this.score = 1 + (headFilter?.score ?? 0);
    this.dependencies = DependencyGraph.fromReverseEdge(
      reverseEdge,
      headFilter?.dependencies,
    );
  }

  public equals(
    expression: unknown,
  ): expression is MultipleReverseEdgeExistsFilter {
    return (
      expression instanceof MultipleReverseEdgeExistsFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public and(
    operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
    }

    return;
  }

  public or(
    operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
    }

    return;
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    const reverseEdgeValues = value[this.reverseEdge.name];
    if (reverseEdgeValues === undefined) {
      return;
    }

    if (!Array.isArray(reverseEdgeValues) || !reverseEdgeValues.length) {
      return false;
    }

    return this.headFilter
      ? reverseEdgeValues.some((reverseEdgeValue) =>
          this.headFilter!.execute(reverseEdgeValue, true),
        )
      : true;
  }

  public get ast(): MultipleReverseEdgeExistsFilterAST {
    return {
      kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return {
      [this.key]: this.headFilter
        ? this.headFilter.inputValue
        : TrueValue.inputValue,
    };
  }
}
