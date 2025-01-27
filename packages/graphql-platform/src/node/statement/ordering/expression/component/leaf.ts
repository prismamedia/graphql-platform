import type * as graphql from 'graphql';
import assert from 'node:assert';
import type { Leaf } from '../../../../definition.js';
import { AbstractOrderingExpression } from '../../abstract-expression.js';
import type { OrderingDirection } from '../../direction.js';

export class LeafOrdering extends AbstractOrderingExpression {
  public constructor(
    public readonly leaf: Leaf,
    direction: OrderingDirection,
    ast: graphql.EnumValueNode,
  ) {
    assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);

    super(direction, ast);
  }

  public get dependency() {
    return this.leaf;
  }
}
