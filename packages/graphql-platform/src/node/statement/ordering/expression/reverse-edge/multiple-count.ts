import type { NodeValue } from '../../../../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  type NodeChange,
  type NodeUpdate,
} from '../../../../change.js';
import type { MultipleReverseEdge } from '../../../../definition.js';
import { OrOperation, type BooleanFilter } from '../../../filter.js';
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
      } else if (change instanceof NodeDeletion) {
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
      } else if (change.hasComponentUpdate(this.reverseEdge.originalEdge)) {
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

    return OrOperation.create(operands);
  }

  public get ast(): MultipleReverseEdgeCountOrderingAST {
    return {
      kind: 'MULTIPLE_REVERSE_EDGE_COUNT',
      reverseEdge: this.reverseEdge.name,
      direction: this.direction,
    };
  }

  public get inputValue() {
    return this.reverseEdge.getOrderingInput(this.direction).name;
  }
}
