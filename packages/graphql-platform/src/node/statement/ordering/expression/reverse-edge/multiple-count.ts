import type * as graphql from 'graphql';
import { ReverseEdgeDependencyGraph } from '../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../definition.js';
import type { NodeOrderingInputValue } from '../../../../type.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export class MultipleReverseEdgeCountOrdering
  implements OrderingExpressionInterface
{
  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly direction: OrderingDirection,
  ) {}

  public equals(expression: unknown): boolean {
    return (
      expression instanceof MultipleReverseEdgeCountOrdering &&
      expression.reverseEdge === this.reverseEdge &&
      expression.direction === this.direction
    );
  }

  public get dependency() {
    return new ReverseEdgeDependencyGraph(this.reverseEdge);
  }

  public get ast(): graphql.EnumValueNode {
    return this.reverseEdge.getOrderingInput(this.direction).ast;
  }

  public get inputValue(): NonNullable<NodeOrderingInputValue> {
    return this.reverseEdge.getOrderingInput(this.direction).name;
  }
}
