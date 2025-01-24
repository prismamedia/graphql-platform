import type * as graphql from 'graphql';
import assert from 'node:assert';
import type { Leaf } from '../../../../definition.js';
import type { NodeOrderingInputValue } from '../../../../type.js';
import { AbstractOrderingExpression } from '../../abstract-expression.js';
import type { OrderingDirection } from '../../direction.js';

export class LeafOrdering extends AbstractOrderingExpression {
  public constructor(
    public readonly leaf: Leaf,
    direction: OrderingDirection,
  ) {
    assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);

    super(direction);
  }

  public override equals(expression: unknown): expression is this {
    return super.equals(expression) && expression.leaf === this.leaf;
  }

  public get dependency() {
    return this.leaf;
  }

  public get ast(): graphql.EnumValueNode {
    return this.leaf.getOrderingInput(this.direction).ast;
  }

  public get inputValue(): NonNullable<NodeOrderingInputValue> {
    return this.leaf.getOrderingInput(this.direction).name;
  }
}
