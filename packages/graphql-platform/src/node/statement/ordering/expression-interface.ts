import type { OrderingDirection } from './direction.js';

export interface OrderingExpressionInterface {
  readonly direction: OrderingDirection;
  readonly reduced?: OrderingExpressionInterface;
  equals(expression: unknown): boolean;

  /**
   * A developer-friendly representation of this expression
   */
  ast: any;
}
