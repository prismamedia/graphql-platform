import * as utils from '@prismamedia/graphql-platform-utils';
import type { NodeValue } from '../../../../../node.js';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractReverseEdgeCreationInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    config: Omit<
      utils.InputConfig<TInputValue>,
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
    inputValue: Readonly<utils.NonNillable<TInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void>;
}
