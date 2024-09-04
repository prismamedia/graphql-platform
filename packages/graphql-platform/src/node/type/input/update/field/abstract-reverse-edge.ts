import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except } from 'type-fest';
import type { NodeValue } from '../../../../../node.js';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import type { MutationContext } from '../../../../operation/mutation/context.js';

export abstract class AbstractReverseEdgeUpdateInput<
  TInputValue,
> extends utils.Input<TInputValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    config: Except<
      utils.InputConfig<TInputValue>,
      'name' | 'public' | 'optional' | 'nullable'
    >,
  ) {
    super({
      description: reverseEdge.description,
      deprecated: reverseEdge.deprecationReason,
      ...config,
      name: reverseEdge.name,
      optional: true,
      nullable: false,
    });
  }

  public abstract hasActions(
    inputValue: Readonly<NonNullable<TInputValue>>,
  ): boolean;

  public abstract applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNullable<TInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void>;
}
