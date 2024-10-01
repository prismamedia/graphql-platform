import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement.js';
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
  protected readonly selectionAware = true;

  public readonly key = 'update-one-if-exists';
  public readonly name = `update${this.node}IfExists`;
  public override readonly description = `Updates one "${this.node}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'data',
        type: this.node.updateInputType,
      }),
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
    args: NodeSelectionAwareArgs<UpdateOneIfExistsMutationArgs>,
    path: utils.Path,
  ): Promise<UpdateOneIfExistsMutationResult> {
    const [nodeValue = null] = await this.node
      .getMutationByKey('update-many')
      .internal(
        context,
        authorization,
        {
          where: args.where,
          first: 1,
          data: args.data,
          selection: args.selection,
        },
        path,
      );

    return nodeValue;
  }
}
