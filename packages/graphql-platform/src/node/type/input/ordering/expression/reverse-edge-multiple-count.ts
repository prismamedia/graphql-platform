import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { ReverseEdgeMultiple } from '../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../operation/context.js';
import {
  OrderingDirection,
  ReverseEdgeMultipleCountOrdering,
} from '../../../../statement/ordering.js';

export class ReverseEdgeMultipleCountOrderingInput extends utils.EnumInputValue {
  readonly #expression: ReverseEdgeMultipleCountOrdering;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    public readonly direction: OrderingDirection,
  ) {
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
    });

    this.#expression = new ReverseEdgeMultipleCountOrdering(
      this.reverseEdge,
      this.direction,
    );
  }

  public sort<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    _context: OperationContext<TRequestContext, TConnector> | undefined,
    _path: utils.Path,
  ): ReverseEdgeMultipleCountOrdering {
    return this.#expression;
  }
}
