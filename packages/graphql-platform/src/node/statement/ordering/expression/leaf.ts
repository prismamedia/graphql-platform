import assert from 'node:assert/strict';
import type { Leaf } from '../../../definition/component/leaf.js';
import type { OrderingDirection } from '../direction.js';
import type { OrderingExpressionInterface } from '../expression-interface.js';

export interface LeafOrderingAST {
  kind: 'LeafOrdering';
  leaf: Leaf['name'];
  direction: OrderingDirection;
}

export class LeafOrdering implements OrderingExpressionInterface {
  public readonly reduced?: this;

  public constructor(
    public readonly leaf: Leaf,
    public readonly direction: OrderingDirection,
  ) {
    assert(leaf.isSortable(), `The leaf "${leaf}" is not sortable`);

    this.reduced = this;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafOrdering &&
      expression.leaf === this.leaf &&
      expression.direction === this.direction
    );
  }

  public get ast(): LeafOrderingAST {
    return {
      kind: 'LeafOrdering',
      leaf: this.leaf.name,
      direction: this.direction,
    };
  }
}
