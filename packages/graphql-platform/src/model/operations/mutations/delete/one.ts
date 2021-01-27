import { Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { WhereUniqueInputValue } from '../../../types/inputs/where-unique';
import { NodeValue } from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { NodeNotFoundError } from '../../errors';
import { AbstractMutation } from '../abstract';

export type DeleteOneOperationArgs = {
  where: WhereUniqueInputValue;
} & RawNodeSelectionAware;

export type DeleteOneOperationResult = NodeValue;

export class DeleteOneOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  DeleteOneOperationArgs,
  DeleteOneOperationResult
> {
  public readonly name = `delete${this.model.name}`;
  public readonly description = `Deletes one "${this.model.name}" node then returns it or throws an error if it does not exist`;

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: GraphQLNonNull(this.model.whereUniqueInputType.type),
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(this.model.nodeType.type);
  }

  protected async doExecute(
    args: SelectionAware<DeleteOneOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<DeleteOneOperationResult> {
    const nodeValue = await this.model.api.deleteIfExists<true>(
      args,
      operationContext,
      path,
    );

    if (!nodeValue) {
      throw new NodeNotFoundError(this.model, args.where, path);
    }

    return nodeValue;
  }
}
