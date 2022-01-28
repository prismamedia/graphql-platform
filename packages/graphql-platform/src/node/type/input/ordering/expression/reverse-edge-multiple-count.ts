import { EnumInputValue, type Path } from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { ReverseEdgeMultiple } from '../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../operation/context.js';
import {
  OrderingDirection,
  ReverseEdgeMultipleCountOrdering,
} from '../../../../statement/ordering.js';

export class ReverseEdgeMultipleCountOrderingInputType extends EnumInputValue {
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
  }

  public sort<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    context: OperationContext<TRequestContext, TConnector> | undefined,
    path: Path,
  ): ReverseEdgeMultipleCountOrdering {
    context?.getNodeAuthorization(this.reverseEdge.head, path);

    return new ReverseEdgeMultipleCountOrdering(
      this.reverseEdge,
      undefined,
      this.direction,
    );
  }
}
