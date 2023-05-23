import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection/value.js';
import type { NodeUniqueFilterInputValue } from '../../../type.js';
import { NotFoundError } from '../../error.js';
import { AbstractDeletion } from '../abstract-deletion.js';
import type { MutationContext } from '../context.js';

export type DeleteOneMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
}>;

export type DeleteOneMutationResult = NodeSelectedValue;

export class DeleteOneMutation<
  TRequestContext extends object,
> extends AbstractDeletion<
  TRequestContext,
  DeleteOneMutationArgs,
  DeleteOneMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `delete${this.node}`;
  public override readonly description = `Deletes one "${this.node}", throws an error if it does not exists`;

  @Memoize()
  public override get arguments() {
    return this.node.getMutationByKey('delete-one-if-exists').arguments;
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<DeleteOneMutationArgs>,
    path: utils.Path,
  ): Promise<DeleteOneMutationResult> {
    const nodeValue = await this.node
      .getMutationByKey('delete-one-if-exists')
      .internal(context, authorization, args, path);

    if (!nodeValue) {
      throw new NotFoundError(this.node, args.where, { path });
    }

    return nodeValue;
  }
}
