import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type {
  NodeSelectedValue,
  NodeValue,
} from '../../../../../../../node.js';
import {
  NodeChange,
  NodeCreation,
  NodeDeletion,
} from '../../../../../../change.js';
import type { UniqueReverseEdge } from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { AbstractReverseEdgeFilter } from '../abstract.js';

export class UniqueReverseEdgeExistsFilter extends AbstractReverseEdgeFilter {
  public static create(
    reverseEdge: UniqueReverseEdge,
    headFilter?: NodeFilter,
  ): BooleanFilter {
    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      if (!headFilter.normalized) {
        return UniqueReverseEdgeExistsFilter.create(reverseEdge);
      } else if (headFilter.isFalse()) {
        return FalseValue;
      }
    }

    return new this(reverseEdge, headFilter);
  }

  public readonly key: string;
  public readonly score: number;

  protected constructor(
    public override readonly reverseEdge: UniqueReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    super(reverseEdge);

    this.key = reverseEdge.name;
    this.score = 1 + (headFilter?.score ?? 0);
  }

  public equals(
    expression: unknown,
  ): expression is UniqueReverseEdgeExistsFilter {
    return (
      expression instanceof UniqueReverseEdgeExistsFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  @Memoize()
  public override get complement(): BooleanFilter | undefined {
    return this.headFilter
      ? new OrOperation([
          new NotOperation(new UniqueReverseEdgeExistsFilter(this.reverseEdge)),
          new UniqueReverseEdgeExistsFilter(
            this.reverseEdge,
            this.headFilter.complement,
          ),
        ])
      : undefined;
  }

  public override and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
        this.reverseEdge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.reverseEdge.head,
              AndOperation.create(
                [this.headFilter.filter, operand.headFilter.filter],
                remainingReducers,
              ),
            )
          : this.headFilter || operand.headFilter,
      );
    }
  }

  public override or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
        this.reverseEdge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.reverseEdge.head,
              OrOperation.create(
                [this.headFilter.filter, operand.headFilter.filter],
                remainingReducers,
              ),
            )
          : undefined,
      );
    }
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const reverseEdgeHeadValue = value[this.reverseEdge.name];

    if (reverseEdgeHeadValue === undefined) {
      return;
    } else if (reverseEdgeHeadValue === null) {
      return false;
    }

    return this.headFilter
      ? this.headFilter.execute(reverseEdgeHeadValue, true)
      : true;
  }

  public override getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter | null {
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

    {
      const affectedHeadFilter =
        this.headFilter?.getAffectedGraphByNodeChange(change);

      if (affectedHeadFilter) {
        operands.push(
          UniqueReverseEdgeExistsFilter.create(
            this.reverseEdge,
            affectedHeadFilter,
          ),
        );
      }
    }

    return operands.length ? OrOperation.create(operands) : null;
  }

  public get inputValue(): NodeFilterInputValue {
    return {
      [this.key]: this.headFilter
        ? this.headFilter.inputValue
        : TrueValue.inputValue,
    };
  }
}
