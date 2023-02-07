import _ from 'lodash';
import type { Node } from '../../node.js';
import { type OrderingExpression } from './ordering/expression.js';

export * from './ordering/direction.js';
export * from './ordering/expression-interface.js';
export * from './ordering/expression.js';

export interface NodeOrderingAST {
  kind: 'NodeOrdering';
  node: Node['name'];
  expressions: OrderingExpression['ast'][];
}

export class NodeOrdering {
  public readonly expressions: ReadonlyArray<OrderingExpression>;
  public readonly normalized: NodeOrdering | undefined;

  public constructor(
    public readonly node: Node,
    expressions: ReadonlyArray<OrderingExpression>,
  ) {
    this.expressions = Object.freeze(
      _.uniqWith(
        expressions.reduce<OrderingExpression[]>(
          (expressions, expression) =>
            expression.reduced
              ? [...expressions, expression.reduced]
              : expressions,
          [],
        ),
        (a, b) => a.equals(b),
      ),
    );

    this.normalized = this.expressions.length === 0 ? undefined : this;
  }

  public equals(nodeOrdering: unknown): boolean {
    return (
      nodeOrdering instanceof NodeOrdering &&
      nodeOrdering.node === this.node &&
      nodeOrdering.expressions.length === this.expressions.length &&
      nodeOrdering.expressions.every((expression, index) =>
        expression.equals(this.expressions[index]),
      )
    );
  }

  public get ast(): NodeOrderingAST {
    return {
      kind: 'NodeOrdering',
      node: this.node.name,
      expressions: this.expressions.map(({ ast }) => ast),
    };
  }
}

export const areOrderingsEqual = (
  a: NodeOrdering | undefined,
  b: NodeOrdering | undefined,
): boolean =>
  a?.normalized && b?.normalized
    ? a.normalized.equals(b.normalized)
    : !a?.normalized && !b?.normalized;
