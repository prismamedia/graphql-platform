import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { Node, NodeValue } from '../../node.js';
import type { NodeChange, NodeUpdate } from '../change.js';
import type { OrderByInputValue } from '../type.js';
import { FalseValue, NodeFilter, OrOperation } from './filter.js';
import type { OrderingExpression } from './ordering/expression.js';

export * from './ordering/direction.js';
export * from './ordering/expression-interface.js';
export * from './ordering/expression.js';

export class NodeOrdering {
  public readonly expressions: ReadonlyArray<OrderingExpression>;
  public readonly normalized: NodeOrdering | undefined;

  public constructor(
    public readonly node: Node,
    expressions: ReadonlyArray<OrderingExpression>,
  ) {
    this.expressions = Object.freeze(
      R.uniqueWith(expressions, (a, b) => a.equals(b)),
    );

    this.normalized = this.expressions.length === 0 ? undefined : this;
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

  public isAffectedByRootUpdate(update: NodeUpdate): boolean {
    assert.equal(update.node, this.node);

    return this.expressions.some((expression) =>
      expression.isAffectedByRootUpdate(update),
    );
  }

  public getAffectedGraph(
    change: NodeChange,
    visitedRootNodes?: ReadonlyArray<NodeValue>,
  ): NodeFilter | null {
    const filter = OrOperation.create(
      R.pipe(
        this.expressions,
        R.map((expression) =>
          expression.getAffectedGraph(change, visitedRootNodes),
        ),
        R.filter(R.isNonNull),
      ),
    );

    return !filter.equals(FalseValue)
      ? new NodeFilter(this.node, filter)
      : null;
  }

  @Memoize()
  public get ast(): graphql.ConstListValueNode {
    return {
      kind: graphql.Kind.LIST,
      values: this.expressions.map(({ ast }) => ast),
    };
  }

  @Memoize()
  public toString(): string {
    return graphql.print(this.ast);
  }

  @Memoize()
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
