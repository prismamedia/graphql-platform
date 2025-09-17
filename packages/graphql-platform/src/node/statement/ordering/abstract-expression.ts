import type * as graphql from 'graphql';
import type { NodeOrderingInputValue } from '../../type.js';
import type { OrderingDirection } from './direction.js';

export abstract class AbstractOrderingExpression {
  /**
   * Returns the input-value for this expression
   */
  public readonly inputValue: NonNullable<NodeOrderingInputValue>;

  public constructor(
    public readonly direction: OrderingDirection,
    public readonly ast: graphql.EnumValueNode,
  ) {
    this.inputValue = ast.value;
  }

  public equals(expression: unknown): expression is this {
    return (
      expression instanceof AbstractOrderingExpression &&
      expression.inputValue === this.inputValue
    );
  }
}
