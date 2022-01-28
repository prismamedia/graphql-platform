import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, NodeFilter } from '../../../../../filter.js';
import { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { BooleanValue } from '../../../value.js';

export interface ReverseEdgeMultipleExistsFilterAST {
  kind: 'ReverseEdgeMultipleExistsFilter';
  reverseEdge: ReverseEdgeMultiple['name'];
  headFilter?: NodeFilter['ast'];
}
export class ReverseEdgeMultipleExistsFilter
  implements BooleanExpressionInterface
{
  public readonly headFilter?: NodeFilter;
  public readonly reduced: BooleanValue | this;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    headFilter?: NodeFilter,
  ) {
    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }

    this.reduced = this.headFilter?.isFalse() ? new BooleanValue(false) : this;
  }

  public equals(
    expression: unknown,
  ): expression is ReverseEdgeMultipleExistsFilter {
    return (
      expression instanceof ReverseEdgeMultipleExistsFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof ReverseEdgeMultipleExistsFilter &&
      expression.reverseEdge === this.reverseEdge
    ) {
      return new ReverseEdgeMultipleExistsFilter(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          new AndOperation([
            this.headFilter?.filter,
            expression.headFilter?.filter,
          ]),
        ),
      );
    } else if (
      expression instanceof NotOperation &&
      expression.operand instanceof ReverseEdgeMultipleExistsFilter &&
      expression.operand.reverseEdge === this.reverseEdge
    ) {
      if (!expression.operand.headFilter) {
        return new BooleanValue(false);
      }
    }
  }

  public or(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof ReverseEdgeMultipleExistsFilter &&
      expression.reverseEdge === this.reverseEdge
    ) {
      return new ReverseEdgeMultipleExistsFilter(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          new OrOperation([
            this.headFilter?.filter,
            expression.headFilter?.filter,
          ]),
        ),
      );
    }
  }

  public get ast(): ReverseEdgeMultipleExistsFilterAST {
    return {
      kind: 'ReverseEdgeMultipleExistsFilter',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }
}
