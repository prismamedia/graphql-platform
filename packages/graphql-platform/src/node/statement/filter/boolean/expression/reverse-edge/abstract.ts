import type { ReverseEdge } from '../../../../../../node.js';
import { AbstractBooleanExpression } from '../abstract.js';

export abstract class AbstractReverseEdgeFilter extends AbstractBooleanExpression {
  public constructor(public readonly reverseEdge: ReverseEdge) {
    super();
  }
}
