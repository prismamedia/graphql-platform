import type { NodeValue } from '../../../../node.js';
import type { DependencyTree } from '../../../result-set.js';

export interface BooleanExpressionInterface {
  /**
   * Returns true if the provided "expression" is equal to "this", false otherwise
   */
  equals(expression: unknown): boolean;

  and?(
    expression: BooleanExpressionInterface,
  ): BooleanExpressionInterface | undefined;

  or?(
    expression: BooleanExpressionInterface,
  ): BooleanExpressionInterface | undefined;

  /**
   * Uses the boolean algebra's (non-)monotone laws to reduce/optimize this expression
   *
   * @see https://en.wikipedia.org/wiki/Boolean_algebra#Laws
   */
  readonly reduced: this | BooleanExpressionInterface;

  /**
   * List of the components & reverse-edges whom changes may change the result-set
   */
  readonly dependencies: DependencyTree | undefined;

  /**
   * @see https://en.wikipedia.org/wiki/Negation
   */
  readonly complement?: BooleanExpressionInterface;

  /**
   * A developer-friendly representation of this expression
   */
  readonly ast: any;

  /**
   * Execute this expression against a partial value, returns undefined if not applicable
   */
  execute(nodeValue: Partial<NodeValue>): boolean | undefined;
}
