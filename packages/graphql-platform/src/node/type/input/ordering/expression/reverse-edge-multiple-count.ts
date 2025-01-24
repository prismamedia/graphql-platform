import type { MultipleReverseEdge } from '../../../../definition/reverse-edge/multiple.js';
import {
  MultipleReverseEdgeCountOrdering,
  OrderingDirection,
} from '../../../../statement/ordering.js';
import { OrderingExpressionInput } from '../expression.js';

export class MultipleReverseEdgeCountOrderingInput extends OrderingExpressionInput<MultipleReverseEdgeCountOrdering> {
  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    direction: OrderingDirection,
  ) {
    const expression = new MultipleReverseEdgeCountOrdering(
      reverseEdge,
      direction,
    );

    super({
      value: `${reverseEdge.countFieldName}_${
        direction === OrderingDirection.ASCENDING ? 'ASC' : 'DESC'
      }`,
      public: reverseEdge.isPublic(),
      description:
        direction === OrderingDirection.ASCENDING
          ? `from the lowest number of "${reverseEdge.name}" to the highest`
          : `from the highest number of "${reverseEdge.name}" to the lowest`,
      deprecated: reverseEdge.deprecationReason,
      direction,
      sort: () => expression,
    });
  }
}
