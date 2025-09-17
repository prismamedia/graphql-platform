import type * as graphql from 'graphql';
import assert from 'node:assert';
import type { MultipleReverseEdge } from '../../../../definition.js';
import type { NodeFilter } from '../../../filter.js';
import { AbstractOrderingExpression } from '../../abstract-expression.js';
import type { OrderingDirection } from '../../direction.js';

export class MultipleReverseEdgeCountOrdering extends AbstractOrderingExpression {
  public readonly headFilter?: NodeFilter;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    direction: OrderingDirection,
    ast: graphql.EnumValueNode,
    headFilter?: NodeFilter | undefined,
  ) {
    super(direction, ast);

    if (headFilter) {
      assert.strictEqual(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }
  }
}
