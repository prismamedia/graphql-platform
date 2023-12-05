import assert from 'node:assert/strict';
import {
  NodeValue,
  type NodeSelectedValue,
} from '../../../../../../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from '../../../../../../change.js';
import type { MultipleReverseEdge } from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import {
  AndOperation,
  OrOperation,
  type AndOperand,
  type OrOperand,
} from '../../../operation.js';
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

  protected constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.key = `${reverseEdge.name}_some`;

    this.score = 1 + (headFilter?.score ?? 0);
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
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return MultipleReverseEdgeExistsFilter.create(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          AndOperation.create(
            [this.headFilter?.filter, operand.headFilter?.filter],
            remainingReducers,
          ),
        ),
      );
    }

    return;
  }

  public or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return MultipleReverseEdgeExistsFilter.create(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          OrOperation.create(
            [this.headFilter?.filter, operand.headFilter?.filter],
            remainingReducers,
          ),
        ),
      );
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

  public isAffectedByNodeUpdate(_update: NodeUpdate): boolean {
    return false;
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    const operands: BooleanFilter[] = [];

    if (change.node === this.reverseEdge.head) {
      if (change instanceof NodeCreation) {
        if (this.headFilter?.execute(change.newValue, true) !== false) {
          const tailFilter = this.reverseEdge.tail.filterInputType.filter(
            change.newValue[this.reverseEdge.originalEdge.name],
          );

          if (
            !tailFilter.isFalse() &&
            !visitedRootNodes?.some((visitedRootNode) =>
              tailFilter.execute(visitedRootNode, false),
            )
          ) {
            operands.push(tailFilter.filter);
          }
        }
      } else if (change instanceof NodeDeletion) {
        if (this.headFilter?.execute(change.oldValue, true) !== false) {
          const tailFilter = this.reverseEdge.tail.filterInputType.filter(
            change.oldValue[this.reverseEdge.originalEdge.name],
          );

          if (
            !tailFilter.isFalse() &&
            !visitedRootNodes?.some((visitedRootNode) =>
              tailFilter.execute(visitedRootNode, false),
            )
          ) {
            operands.push(tailFilter.filter);
          }
        }
      } else if (
        change.hasComponentUpdate(this.reverseEdge.originalEdge) ||
        this.headFilter?.isAffectedByNodeUpdate(change)
      ) {
        if (this.headFilter?.execute(change.newValue, true) !== false) {
          const newTailFilter = this.reverseEdge.tail.filterInputType.filter(
            change.newValue[this.reverseEdge.originalEdge.name],
          );

          if (
            !newTailFilter.isFalse() &&
            !visitedRootNodes?.some((visitedRootNode) =>
              newTailFilter.execute(visitedRootNode, false),
            )
          ) {
            operands.push(newTailFilter.filter);
          }
        }

        if (this.headFilter?.execute(change.oldValue, true) !== false) {
          const oldTailFilter = this.reverseEdge.tail.filterInputType.filter(
            change.oldValue[this.reverseEdge.originalEdge.name],
          );

          if (
            !oldTailFilter.isFalse() &&
            !visitedRootNodes?.some((visitedRootNode) =>
              oldTailFilter.execute(visitedRootNode, false),
            )
          ) {
            operands.push(oldTailFilter.filter);
          }
        }
      }
    }

    if (this.headFilter) {
      operands.push(
        MultipleReverseEdgeExistsFilter.create(
          this.reverseEdge,
          this.headFilter.getAffectedGraphByNodeChange(change),
        ),
      );
    }

    return OrOperation.create(operands);
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
