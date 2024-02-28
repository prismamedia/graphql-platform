import { Memoize } from '@prismamedia/memoize';
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
      R.uniqWith(expressions, (a, b) => a.equals(b)),
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

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    assert.equal(update.node, this.node);

    return this.expressions.some((expression) =>
      expression.isAffectedByNodeUpdate(update),
    );
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): NodeFilter | null {
    const filter = OrOperation.create(
      R.pipe(
        this.expressions,
        R.map((expression) =>
          expression.getAffectedGraphByNodeChange(change, visitedRootNodes),
        ),
        R.filter(R.isNonNull),
      ),
    );

    return !filter.equals(FalseValue)
      ? new NodeFilter(this.node, filter)
      : null;
  }

  @Memoize()
  public get inputValue(): NonNullable<OrderByInputValue> {
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
