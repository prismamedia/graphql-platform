import type * as graphql from 'graphql';
import assert from 'node:assert';
import type { Leaf } from '../../../../definition.js';
import type { NodeOrderingInputValue } from '../../../../type.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export class LeafOrdering implements OrderingExpressionInterface {
  public constructor(
    public readonly leaf: Leaf,
    public readonly direction: OrderingDirection,
  ) {
    assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafOrdering &&
      expression.leaf === this.leaf &&
      expression.direction === this.direction
    );
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
