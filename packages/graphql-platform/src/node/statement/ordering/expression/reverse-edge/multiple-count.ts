import type * as graphql from 'graphql';
import { ReverseEdgeDependencyGraph } from '../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../definition.js';
import { AbstractOrderingExpression } from '../../abstract-expression.js';
import type { OrderingDirection } from '../../direction.js';

export class MultipleReverseEdgeCountOrdering extends AbstractOrderingExpression {
  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    direction: OrderingDirection,
    ast: graphql.EnumValueNode,
  ) {
    super(direction, ast);
  }

  public get dependency() {
    return new ReverseEdgeDependencyGraph(this.reverseEdge);
  }
}
