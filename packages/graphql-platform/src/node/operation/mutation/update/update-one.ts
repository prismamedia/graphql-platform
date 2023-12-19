import type * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../../statement.js';
import type {
  NodeUniqueFilterInputValue,
  NodeUpdateInputValue,
} from '../../../type.js';
import { NotFoundError } from '../../error.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateOneMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  data?: NodeUpdateInputValue;
}>;

export type UpdateOneMutationResult = NodeSelectedValue;

export class UpdateOneMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  TRequestContext,
  UpdateOneMutationArgs,
  UpdateOneMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'update-one';
  public readonly name = `update${this.node}`;
  public readonly description = `Updates one "${this.node}", throws an error if it does not exists`;

  public get arguments() {
    return this.node.getMutationByKey('update-one-if-exists').arguments;
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<UpdateOneMutationArgs>,
    path: utils.Path,
  ): Promise<UpdateOneMutationResult> {
    const nodeValue = await this.node
      .getMutationByKey('update-one-if-exists')
      .internal(context, authorization, args, path);

    if (!nodeValue) {
      throw new NotFoundError(this.node, args.where, { path });
    }

    return nodeValue;
  }
}
