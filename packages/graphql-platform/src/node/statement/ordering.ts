import { Memoize } from '@prismamedia/memoize';
import * as R from 'remeda';
import type { Node } from '../../node.js';
import type { DependencyGraph } from '../subscription.js';
import type { OrderByInputValue } from '../type.js';
import type { OrderingExpression } from './ordering/expression.js';

export * from './ordering/direction.js';
export * from './ordering/expression-interface.js';
export * from './ordering/expression.js';

export interface NodeOrderingAST {
  kind: 'NODE';
  node: Node['name'];
  expressions: OrderingExpression['ast'][];
}

export class NodeOrdering {
  public readonly expressions: ReadonlyArray<OrderingExpression>;
  public readonly normalized: NodeOrdering | undefined;

  /**
   * Used in subscriptions to know wich nodes to fetch
   */
  public readonly dependencies?: DependencyGraph;

  public constructor(
    public readonly node: Node,
    expressions: ReadonlyArray<OrderingExpression>,
  ) {
    this.expressions = Object.freeze(
      R.uniqWith(expressions, (a, b) => a.equals(b)),
    );

    this.normalized = this.expressions.length === 0 ? undefined : this;

    this.dependencies = this.expressions.reduce<DependencyGraph | undefined>(
      (dependencies, expression) =>
        dependencies && expression.dependencies
          ? dependencies.mergeWith(expression.dependencies)
          : dependencies || expression.dependencies,
      undefined,
    );
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

  public get ast(): NodeOrderingAST {
    return {
      kind: 'NODE',
      node: this.node.name,
      expressions: this.expressions.map(({ ast }) => ast),
    };
  }

  @Memoize()
  public get inputValue(): OrderByInputValue {
    return Array.from(this.expressions, ({ inputValue }) => inputValue);
  }
}

export const areOrderingsEqual = (
  a: NodeOrdering | undefined,
  b: NodeOrdering | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : a?.normalized === b?.normalized;
