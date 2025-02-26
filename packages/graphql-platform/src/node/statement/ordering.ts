import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import * as R from 'remeda';
import type { Node } from '../../node.js';
import { DependencyGraph } from '../change/dependency.js';
import type { OrderByInputValue } from '../type.js';
import type { OrderingExpression } from './ordering/expression.js';

export * from './ordering/direction.js';
export * from './ordering/expression.js';

export class NodeOrdering {
  public readonly expressions: ReadonlyArray<OrderingExpression>;
  public readonly normalized: this | undefined;

  public constructor(
    public readonly node: Node,
    expressions: ReadonlyArray<OrderingExpression>,
  ) {
    this.expressions = R.uniqueWith(expressions, (a, b) => a.equals(b));

    this.normalized = this.expressions.length ? this : undefined;
  }

  public equals(ordering: unknown): boolean {
    return (
      ordering instanceof NodeOrdering &&
      ordering.node === this.node &&
      ordering.expressions.length === this.expressions.length &&
      ordering.expressions.every((expression, index) =>
        expression.equals(this.expressions[index]),
      )
    );
  }

  @MGetter
  public get dependencyGraph(): DependencyGraph {
    return new DependencyGraph(
      this.node,
      ...this.expressions.map(({ dependency }) => dependency),
    );
  }

  @MGetter
  public get ast(): graphql.ConstListValueNode {
    return {
      kind: graphql.Kind.LIST,
      values: this.expressions.map(({ ast }) => ast),
    };
  }

  @MMethod()
  public toString(): string {
    return graphql.print(this.ast);
  }

  @MGetter
  public get inputValue(): NonNullable<OrderByInputValue> {
    return this.expressions.map(({ inputValue }) => inputValue);
  }
}

export const areOrderingsEqual = (
  a: NodeOrdering | undefined,
  b: NodeOrdering | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
