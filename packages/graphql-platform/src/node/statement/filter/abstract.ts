import type * as graphql from 'graphql';
import type { NodeChange } from '../../change.js';
import type { RawDependency } from '../../dependency.js';
import type { NodeFilterInputValue } from '../../type.js';
import type { NodeSelectedValue, NodeSelection } from '../selection.js';
import type { AndOperand, BooleanFilter, OrOperand } from './boolean.js';

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

  public abstract isExecutableWithin(selection: NodeSelection): boolean;

  /**
   * Execute this expression against a partial value, returns undefined if not applicable
   */
  public execute(value: NodeSelectedValue): boolean | undefined {
    return;
  }

  public isEdgeHeadChangeFilteredOut(_change: NodeChange): boolean {
    return false;
  }

  public abstract get dependencies(): RawDependency[];
}
