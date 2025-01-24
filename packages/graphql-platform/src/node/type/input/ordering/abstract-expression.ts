import * as utils from '@prismamedia/graphql-platform-utils';
import type { OperationContext } from '../../../operation.js';
import {
  OrderingDirection,
  type OrderingExpression,
} from '../../../statement/ordering.js';

export abstract class AbstractOrderingExpressionInput extends utils.EnumInputValue {
  public abstract readonly direction: OrderingDirection;

  public abstract sort(
    context?: OperationContext,
    path?: utils.Path,
  ): OrderingExpression;
}
