import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement.js';
import { AbstractDeletion } from '../abstract-deletion.js';
import type { MutationContext } from '../context.js';
import type {
  DeleteOneMutationArgs,
  DeleteOneMutationResult,
} from './delete-one.js';

export type DeleteOneIfExistsMutationArgs = DeleteOneMutationArgs;

export type DeleteOneIfExistsMutationResult = DeleteOneMutationResult | null;

export class DeleteOneIfExistsMutation<
  TRequestContext extends object,
> extends AbstractDeletion<
  DeleteOneIfExistsMutationArgs,
  DeleteOneIfExistsMutationResult,
  TRequestContext
> {
  protected readonly selectionAware = true;

  public readonly key = 'delete-one-if-exists';
  public readonly name = `delete${this.node}IfExists`;
  public override readonly description = `Deletes one "${this.node}" if it exists, returns null otherwise`;

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<DeleteOneIfExistsMutationArgs>,
    path: utils.Path,
  ): Promise<DeleteOneIfExistsMutationResult> {
    const [nodeValue = null] = await this.node
      .getMutationByKey('delete-many')
      .internal(
        context,
        authorization,
        {
          where: args.where,
          first: 1,
          selection: args.selection,
        },
        path,
      );

    return nodeValue;
  }
}
