import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../../definition/reverse-edge/multiple.js';
import {
  mergeDependencyTrees,
  type DependencyTree,
} from '../../../../../../result-set.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { FalseValue } from '../../../value.js';

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

  public readonly score: number;
  public readonly dependencies: DependencyTree;

  protected constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.score = 1 + (headFilter?.score ?? 0);
    this.dependencies = new Map([
      [
        reverseEdge,
        mergeDependencyTrees([
          new Map([[reverseEdge.originalEdge, undefined]]),
          headFilter?.dependencies,
        ]),
      ],
    ]);
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

  public get ast(): MultipleReverseEdgeExistsFilterAST {
    return {
      kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }

  public execute(_nodeValue: Partial<NodeValue>): undefined {
    return;
  }
}
