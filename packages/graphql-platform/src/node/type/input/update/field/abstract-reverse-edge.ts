import {
  Input,
  NonNillable,
  type InputConfig,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import type { NodeValue } from '../../../../../node.js';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractReverseEdgeUpdateInput<
  TInputValue,
> extends Input<TInputValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    config: Omit<
      InputConfig<TInputValue>,
      'name' | 'public' | 'optional' | 'nullable'
    >,
  ) {
    super({
      description: reverseEdge.description,
      deprecated: reverseEdge.deprecationReason,
      ...config,
      name: reverseEdge.name,
      public: reverseEdge.isPublic(),
      optional: true,
      nullable: false,
    });
  }

  public abstract applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNillable<TInputValue>>,
    context: MutationContext,
    path: Path,
  ): Promise<void>;
}
