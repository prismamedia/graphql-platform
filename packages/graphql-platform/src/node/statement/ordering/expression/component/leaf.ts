import assert from 'node:assert/strict';
import { NodeValue } from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { Leaf } from '../../../../definition.js';
import { FalseValue, type BooleanFilter } from '../../../filter.js';
import type { OrderingDirection } from '../../direction.js';
import type { OrderingExpressionInterface } from '../../expression-interface.js';

export interface LeafOrderingAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  direction: OrderingDirection;
}

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

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return update.hasComponentUpdate(this.leaf);
  }

  public getAffectedGraphByNodeChange(
    _change: NodeChange,
    _visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return FalseValue;
  }

  public get ast(): LeafOrderingAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      direction: this.direction,
    };
  }

  public get inputValue() {
    return this.leaf.getOrderingInput(this.direction).name;
  }
}
