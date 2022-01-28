import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, type NodeFilter } from '../../filter.js';
import type { OrderingDirection } from '../direction.js';
import type { OrderingExpressionInterface } from '../expression-interface.js';

export interface ReverseEdgeMultipleCountOrderingAST {
  kind: 'ReverseEdgeMultipleCountOrdering';
  reverseEdge: ReverseEdgeMultiple['name'];
  headFilter?: NodeFilter['ast'];
  direction: OrderingDirection;
}

export class ReverseEdgeMultipleCountOrdering
  implements OrderingExpressionInterface
{
  public readonly headFilter?: NodeFilter;
  public readonly reduced?: this;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    headFilter: NodeFilter | undefined,
    public readonly direction: OrderingDirection,
  ) {
    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }

    this.reduced = this.headFilter?.isFalse() ? undefined : this;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof ReverseEdgeMultipleCountOrdering &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter) &&
      expression.direction === this.direction
    );
  }

  public get ast(): ReverseEdgeMultipleCountOrderingAST {
    return {
      kind: 'ReverseEdgeMultipleCountOrdering',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
      direction: this.direction,
    };
  }
}
