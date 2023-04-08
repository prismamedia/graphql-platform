import type { DependencyTree } from '../../result-set.js';
import type { OrderingDirection } from './direction.js';

export interface OrderingExpressionInterface {
  readonly direction: OrderingDirection;
  readonly reduced?: OrderingExpressionInterface;

  /**
   * List of the components & reverse-edges whom changes may change the result-set
   */
  readonly dependencies: DependencyTree;

  equals(expression: unknown): boolean;

  /**
   * A developer-friendly representation of this expression
   */
  ast: any;
}
