import type { NodeValue } from '../../../node.js';
import type { NodeChange, NodeUpdate } from '../../change.js';
import type { BooleanFilter } from '../filter.js';
import type { OrderingDirection } from './direction.js';

export interface OrderingExpressionInterface {
  readonly direction: OrderingDirection;

  equals(expression: unknown): boolean;

  /**
   * Is the provided update affecting this expression?
   */
  isAffectedByNodeUpdate(update: NodeUpdate): boolean;

  getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter;

  /**
   * A developer-friendly representation of this expression
   */
  readonly ast: any;
}
