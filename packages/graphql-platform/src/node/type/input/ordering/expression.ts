import * as utils from '@prismamedia/graphql-platform-utils';
import type { OperationContext } from '../../../operation.js';
import type {
  OrderingDirection,
  OrderingExpression,
} from '../../../statement/ordering.js';

export type OrderingExpressionInputConfig<T extends OrderingExpression = any> =
  utils.EnumInputValueConfig & {
    direction: OrderingDirection;
    sort(context?: OperationContext, path?: utils.Path): T;
  };

export class OrderingExpressionInput<
  T extends OrderingExpression = any,
> extends utils.EnumInputValue {
  public readonly direction: OrderingDirection;
  public readonly sort: OrderingExpressionInputConfig<T>['sort'];

  public constructor({
    direction,
    sort,
    ...config
  }: OrderingExpressionInputConfig<T>) {
    super(config);

    this.direction = direction;
    this.sort = sort;
  }
}
