import assert from 'node:assert/strict';
import type { Leaf } from '../../../../definition/component/leaf.js';
import type { DependencyTree } from '../../../../result-set.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export interface LeafOrderingAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  direction: OrderingDirection;
}

export class LeafOrdering implements OrderingExpressionInterface {
  public readonly dependencies: DependencyTree;

  public constructor(
    public readonly leaf: Leaf,
    public readonly direction: OrderingDirection,
  ) {
    assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);

    this.dependencies = new Map([[leaf, undefined]]);
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
      kind: 'LEAF',
      leaf: this.leaf.name,
      direction: this.direction,
    };
  }
}
