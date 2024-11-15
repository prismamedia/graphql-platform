import type * as graphql from 'graphql';
import type { Dependency } from '../../change.js';
import type { NodeOrderingInputValue } from '../../type.js';
import type { OrderingDirection } from './direction.js';

export interface OrderingExpressionInterface {
  readonly direction: OrderingDirection;

  /**
   * Returns the AST for this expression
   */
  readonly ast: graphql.EnumValueNode;

  /**
   * Returns the input-value for this expression
   */
  readonly inputValue: NonNullable<NodeOrderingInputValue>;

  equals(expression: unknown): boolean;

  dependency?: Dependency;
}
