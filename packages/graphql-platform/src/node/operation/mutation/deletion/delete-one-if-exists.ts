import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement/filter.js';
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
  TRequestContext,
  DeleteOneIfExistsMutationArgs,
  DeleteOneIfExistsMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `delete${this.node}IfExists`;
  public override readonly description = `Deletes one "${this.node}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override async executeWithValidArgumentsAndContext(
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
