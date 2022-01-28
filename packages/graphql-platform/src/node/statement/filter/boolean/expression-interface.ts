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
   * @see https://en.wikipedia.org/wiki/Negation
   */
  readonly complement?: BooleanExpressionInterface;

  /**
   * A developer-friendly representation of this expression
   */
  readonly ast: any;
}
