import * as graphql from 'graphql';
import type { NodeSelectedValue, UniqueConstraint } from '../../../node.js';
import type { Dependency } from '../../change.js';

import type { Arrayable } from 'type-fest';
import type { NodeFilterInputValue } from '../../type.js';
import {
  type AndOperand,
  type BooleanFilter,
  type OrOperand,
} from './boolean.js';

export abstract class AbstractBooleanFilter {
  /**
   * Used to sort expressions, the lower the better
   *
   * = 1 + operands' score
   */
  public abstract readonly score: number;

  /**
   * Returns true if the provided "expression" is equal to "this", false otherwise
   */
  public abstract equals(expression: unknown): boolean;

  /**
   * Returns the AST for this expression
   */
  public abstract get ast():
    | graphql.ConstObjectValueNode
    | graphql.NullValueNode;

  /**
   * Returns the input-value for this expression
   */
  public abstract get inputValue(): Exclude<NodeFilterInputValue, undefined>;

  /**
   * Returns the logical negation, if possible
   *
   * @see https://en.wikipedia.org/wiki/Negation
   */
  public get complement(): BooleanFilter | undefined {
    return;
  }

  /**
   * Reduce the conjunction of this expression with the provided operand, if possible
   *
   * @see https://en.wikipedia.org/wiki/Logical_conjunction
   */
  public and(
    _operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    return;
  }

  /**
   * Reduce the disjunction of this expression with the provided operand, if possible
   *
   * @see https://en.wikipedia.org/wiki/Disjunction_(logical_connective)
   */
  public or(
    _operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    return;
  }

  /**
   * Execute this expression against a partial value, returns undefined if not applicable
   */
  public execute(_value: NodeSelectedValue): boolean | undefined {
    return;
  }

  /**
   * Is the provided unique-constraint's value enough to execute this filter's expression?
   */
  public isExecutableWithinUniqueConstraint(
    _unique: UniqueConstraint,
  ): boolean {
    return false;
  }

  public abstract get dependency(): Arrayable<Dependency | undefined>;
}
