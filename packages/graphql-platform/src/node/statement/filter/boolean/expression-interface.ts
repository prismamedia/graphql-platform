import type { DependencyGraph } from '../../../operation/dependency-graph.js';
import type { NodeSelectedValue } from '../../selection.js';
import type { AndOperand, BooleanFilter, OrOperand } from '../boolean.js';

export interface BooleanExpressionInterface {
  /**
   * Returns true if the provided "expression" is equal to "this", false otherwise
   */
  equals(expression: unknown): boolean;

  /**
   * Used to sort expressions, the lower the better
   *
   * = 1 + operands' score
   */
  readonly score: number;

  /**
   * Returns the logical negation, if possible
   *
   * @see https://en.wikipedia.org/wiki/Negation
   */
  readonly complement?: BooleanFilter | undefined;

  /**
   * Reduce the conjunction of this expression with the provided operand, if possible
   *
   * @see https://en.wikipedia.org/wiki/Logical_conjunction
   */
  and?(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined;

  /**
   * Reduce the disjunction of this expression with the provided operand, if possible
   *
   * @see https://en.wikipedia.org/wiki/Disjunction_(logical_connective)
   */
  or?(operand: OrOperand, remainingReducers: number): BooleanFilter | undefined;

  /**
   * A developer-friendly representation of this expression
   */
  readonly ast: any;

  /**
   * Execute this expression against a partial value, returns undefined if not applicable
   */
  execute(value: NodeSelectedValue): boolean | undefined;

  /**
   * Returns the dependency graph of this expression, if any
   */
  readonly dependencies?: DependencyGraph;
}
