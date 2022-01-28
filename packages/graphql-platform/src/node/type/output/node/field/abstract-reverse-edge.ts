import type {
  Nillable,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import { AbstractNodeFieldOutputType } from '../abstract-field.js';

export abstract class AbstractReverseEdgeOutputType<
  TArgs extends Nillable<PlainObject>,
> extends AbstractNodeFieldOutputType<TArgs> {
  public constructor(public readonly reverseEdge: ReverseEdge) {
    super();
  }

  public override isPublic(): boolean {
    return this.reverseEdge.isPublic();
  }
}
