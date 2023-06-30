import * as R from 'remeda';
import type { Node } from '../../node.js';
import { mergeDependencyTrees, type DependencyTree } from '../result-set.js';
import { type OrderingExpression } from './ordering/expression.js';

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
   * List of the components & reverse-edges whom changes may change the result-set
   */
  public readonly dependencies: DependencyTree;

  public constructor(
    public readonly node: Node,
    expressions: ReadonlyArray<OrderingExpression>,
  ) {
    this.expressions = Object.freeze(
      R.uniqWith(expressions, (a, b) => a.equals(b)),
    );

    this.normalized = this.expressions.length === 0 ? undefined : this;

    this.dependencies = mergeDependencyTrees(
      this.expressions.map(({ dependencies }) => dependencies),
    )!;
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
      kind: 'NODE',
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
    : a?.normalized === b?.normalized;
