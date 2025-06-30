import type { ReverseEdge } from '../../../../../node.js';
import type { NodeSelection } from '../../../selection.js';
import { AbstractBooleanExpression } from '../abstract-expression.js';

export abstract class AbstractReverseEdgeFilter extends AbstractBooleanExpression {
  public constructor(public readonly reverseEdge: ReverseEdge) {
    super();
  }

  public override isExecutableWithin(_selection: NodeSelection): boolean {
    return false;
  }
}
