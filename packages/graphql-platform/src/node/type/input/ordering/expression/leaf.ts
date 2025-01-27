import assert from 'node:assert';
import type { Leaf } from '../../../../definition/component/leaf.js';
import {
  LeafOrdering,
  OrderingDirection,
} from '../../../../statement/ordering.js';
import { OrderingExpressionInput } from '../expression.js';

export class LeafOrderingInput extends OrderingExpressionInput<LeafOrdering> {
  public constructor(
    public readonly leaf: Leaf,
    direction: OrderingDirection,
  ) {
    assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);

    super({
      value: `${leaf.name}_${
        direction === OrderingDirection.ASCENDING ? 'ASC' : 'DESC'
      }`,
      public: leaf.isPublic(),
      description:
        direction === OrderingDirection.ASCENDING
          ? `from the lowest "${leaf.name}" to the highest`
          : `from the highest "${leaf.name}" to the lowest`,
      deprecated: leaf.deprecationReason,
      direction,
      sort: () => new LeafOrdering(leaf, direction, this.ast),
    });
  }
}
