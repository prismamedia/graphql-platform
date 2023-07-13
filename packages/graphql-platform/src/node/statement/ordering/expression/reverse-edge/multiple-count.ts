import type { MultipleReverseEdge } from '../../../../definition/reverse-edge/multiple.js';
import { DependencyGraph } from '../../../../subscription.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export interface MultipleReverseEdgeCountOrderingAST {
  kind: 'MULTIPLE_REVERSE_EDGE_COUNT';
  reverseEdge: MultipleReverseEdge['name'];
  direction: OrderingDirection;
}

export class MultipleReverseEdgeCountOrdering
  implements OrderingExpressionInterface
{
  public readonly dependencies: DependencyGraph;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly direction: OrderingDirection,
  ) {
    this.dependencies = DependencyGraph.fromReverseEdge(reverseEdge);
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof MultipleReverseEdgeCountOrdering &&
      expression.reverseEdge === this.reverseEdge &&
      expression.direction === this.direction
    );
  }

  public get ast(): MultipleReverseEdgeCountOrderingAST {
    return {
      kind: 'MULTIPLE_REVERSE_EDGE_COUNT',
      reverseEdge: this.reverseEdge.name,
      direction: this.direction,
    };
  }
}
