import type { NodeValue } from '../../../node.js';
import type { NodeChange, NodeUpdate } from '../../change.js';
import type { NodeOrderingInputValue } from '../../type.js';
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
  ): BooleanFilter | null;

  /**
   * Returns the input-value for this expression
   */
  inputValue: NonNullable<NodeOrderingInputValue>;
}
