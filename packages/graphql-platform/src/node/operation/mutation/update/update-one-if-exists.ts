import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement/filter.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';
import type {
  UpdateOneMutationArgs,
  UpdateOneMutationResult,
} from './update-one.js';

export type UpdateOneIfExistsMutationArgs = UpdateOneMutationArgs;

export type UpdateOneIfExistsMutationResult = UpdateOneMutationResult | null;

export class UpdateOneIfExistsMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  TRequestContext,
  UpdateOneIfExistsMutationArgs,
  UpdateOneIfExistsMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `update${this.node}IfExists`;
  public override readonly description = `Updates one "${this.node}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new utils.Input({
        name: 'data',
        type: utils.nonNillableInputType(this.node.updateInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<UpdateOneIfExistsMutationArgs>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<UpdateOneIfExistsMutationResult> {
    const [nodeValue = null] = await this.node
      .getMutationByKey('update-many')
      .internal(
        authorization,
        {
          where: args.where,
          first: 1,
          data: args.data,
          selection: args.selection,
        },
        context,
        path,
      );

    return nodeValue;
  }
}
