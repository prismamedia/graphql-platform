import type * as utils from '@prismamedia/graphql-platform-utils';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import { NodeOutputType } from '../../node.js';
import { AbstractFieldOutputType } from '../abstract-field.js';

export abstract class AbstractReverseEdgeOutputType<
  TArgs extends utils.Nillable<utils.PlainObject>,
> extends AbstractFieldOutputType<TArgs> {
  public constructor(
    public readonly parent: NodeOutputType,
    public readonly reverseEdge: ReverseEdge,
  ) {
    super();
  }

  public override isPublic(): boolean {
    return this.reverseEdge.isPublic();
  }
}
