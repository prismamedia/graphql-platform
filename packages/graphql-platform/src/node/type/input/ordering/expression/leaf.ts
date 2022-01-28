import { EnumInputValue, Path } from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { Leaf } from '../../../../definition/component/leaf.js';
import type { OperationContext } from '../../../../operation/context.js';
import {
  LeafOrdering,
  OrderingDirection,
} from '../../../../statement/ordering.js';

export class LeafOrderingInputType extends EnumInputValue {
  readonly #expression: LeafOrdering;

  public constructor(
    public readonly leaf: Leaf,
    public readonly direction: OrderingDirection,
  ) {
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

  public sort<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    _context: OperationContext<TRequestContext, TConnector> | undefined,
    _path: Path,
  ): LeafOrdering {
    return this.#expression;
  }
}
