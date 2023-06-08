import type { MultipleReverseEdge } from '../../../../definition/reverse-edge/multiple.js';
import type { DependencyTree } from '../../../../result-set.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export interface MultipleReverseEdgeCountOrderingAST {
  kind: 'MultipleReverseEdgeCountOrdering';
  reverseEdge: MultipleReverseEdge['name'];
  direction: OrderingDirection;
}

export class MultipleReverseEdgeCountOrdering
  implements OrderingExpressionInterface
{
  public readonly reduced: this;
  public readonly dependencies: DependencyTree;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly direction: OrderingDirection,
  ) {
    this.reduced = this;
    this.dependencies = new Map([
      [reverseEdge, new Map([[reverseEdge.originalEdge, undefined]])],
    ]);
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
      kind: 'MultipleReverseEdgeCountOrdering',
      reverseEdge: this.reverseEdge.name,
      direction: this.direction,
    };
  }
}
