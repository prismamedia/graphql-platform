import {
  Input,
  nonNillableInputType,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
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
  TConnector extends ConnectorInterface,
> extends AbstractDeletion<
  TRequestContext,
  TConnector,
  DeleteOneIfExistsMutationArgs,
  DeleteOneIfExistsMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `delete${this.node.name}IfExists`;
  public override readonly description = `Deletes one "${this.node.name}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<DeleteOneIfExistsMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<DeleteOneIfExistsMutationResult> {
    const [nodeValue = null] = await this.node
      .getMutation('delete-many')
      .execute(
        {
          where: args.where,
          first: 1,
          selection: args.selection,
        },
        context,
        path,
      );

    return nodeValue;
  }
}
