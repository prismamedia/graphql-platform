import type { DependencyGraph } from '../../operation/dependency-graph.js';
import type { OrderingDirection } from './direction.js';

export interface OrderingExpressionInterface {
  readonly direction: OrderingDirection;

  equals(expression: unknown): boolean;

  /**
   * A developer-friendly representation of this expression
   */
  ast: any;

  /**
   * Returns the dependency graph of this expression, if any
   */
  readonly dependencies?: DependencyGraph;
}
