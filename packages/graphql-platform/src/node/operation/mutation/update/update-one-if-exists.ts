import {
  Input,
  nonNillableInputType,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
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
  TConnector extends ConnectorInterface,
> extends AbstractUpdate<
  TRequestContext,
  TConnector,
  UpdateOneIfExistsMutationArgs,
  UpdateOneIfExistsMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `update${this.node.name}IfExists`;
  public override readonly description = `Updates one "${this.node.name}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new Input({
        name: 'data',
        type: nonNillableInputType(this.node.updateInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<UpdateOneIfExistsMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<UpdateOneIfExistsMutationResult> {
    const [nodeValue = null] = await this.node
      .getMutationByKey('update-many')
      .execute(
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
