import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { Leaf } from '../../../../definition/component/leaf.js';
import type { OperationContext } from '../../../../operation/context.js';
import {
  LeafOrdering,
  OrderingDirection,
} from '../../../../statement/ordering.js';

export class LeafOrderingInput extends utils.EnumInputValue {
  readonly #expression: LeafOrdering;

  public constructor(
    public readonly leaf: Leaf,
    public readonly direction: OrderingDirection,
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
    });

    this.#expression = new LeafOrdering(this.leaf, this.direction);
  }

  public sort<TRequestContext extends object>(
    _context?: OperationContext<TRequestContext> | undefined,
    _path?: utils.Path,
  ): LeafOrdering {
    return this.#expression;
  }
}
