import type * as graphql from 'graphql';
import { ReverseEdgeDependencyGraph } from '../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../definition.js';
import type { NodeOrderingInputValue } from '../../../../type.js';
import { AbstractOrderingExpression } from '../../abstract-expression.js';
import type { OrderingDirection } from '../../direction.js';

export class MultipleReverseEdgeCountOrdering extends AbstractOrderingExpression {
  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    direction: OrderingDirection,
  ) {
    super(direction);
  }

  public override equals(expression: unknown): expression is this {
    return (
      super.equals(expression) && expression.reverseEdge === this.reverseEdge
    );
  }

  public get dependency() {
    return new ReverseEdgeDependencyGraph(this.reverseEdge);
  }

  public get ast(): graphql.EnumValueNode {
    return this.reverseEdge.getOrderingInput(this.direction).ast;
  }

  public get inputValue(): NonNullable<NodeOrderingInputValue> {
    return this.reverseEdge.getOrderingInput(this.direction).name;
  }
}
