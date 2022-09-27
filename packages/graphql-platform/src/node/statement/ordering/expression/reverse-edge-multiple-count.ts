import type { ReverseEdgeMultiple } from '../../../definition/reverse-edge/multiple.js';
import type { OrderingDirection } from '../direction.js';
import type { OrderingExpressionInterface } from '../expression-interface.js';

export interface ReverseEdgeMultipleCountOrderingAST {
  kind: 'ReverseEdgeMultipleCountOrdering';
  reverseEdge: ReverseEdgeMultiple['name'];
  direction: OrderingDirection;
}

export class ReverseEdgeMultipleCountOrdering
  implements OrderingExpressionInterface
{
  public readonly reduced?: this;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    public readonly direction: OrderingDirection,
  ) {
    this.reduced = this;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof ReverseEdgeMultipleCountOrdering &&
      expression.reverseEdge === this.reverseEdge &&
      expression.direction === this.direction
    );
  }

  public get ast(): ReverseEdgeMultipleCountOrderingAST {
    return {
      kind: 'ReverseEdgeMultipleCountOrdering',
      reverseEdge: this.reverseEdge.name,
      direction: this.direction,
    };
  }
}
