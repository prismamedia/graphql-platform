import type * as graphql from 'graphql';
import type { Constructor } from 'type-fest';
import type { Dependency } from '../../change.js';
import type { NodeOrderingInputValue } from '../../type.js';
import type { OrderingDirection } from './direction.js';

export abstract class AbstractOrderingExpression {
  /**
   * Returns the AST for this expression
   */
  public abstract readonly ast: graphql.EnumValueNode;

  /**
   * Returns the input-value for this expression
   */
  public abstract readonly inputValue: NonNullable<NodeOrderingInputValue>;

  public abstract readonly dependency?: Dependency;

  public constructor(public readonly direction: OrderingDirection) {}

  public equals(expression: unknown): expression is this {
    return (
      expression instanceof (this.constructor as Constructor<this>) &&
      expression.direction === this.direction
    );
  }
}
