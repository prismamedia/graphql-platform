import { Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { ConnectorInterface } from '../../../connector';
import { WhereUniqueInputValue } from '../../types/inputs/where-unique';
import { NodeValue } from '../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../abstract';
import { OperationContext } from '../context';
import { NodeNotFoundError } from '../errors';
import { AbstractQuery } from './abstract';

export type GetOneOperationArgs = {
  where: WhereUniqueInputValue;
} & RawNodeSelectionAware;

export type GetOneOperationResult = NodeValue;

export class GetOneOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  GetOneOperationArgs,
  GetOneOperationResult
> {
  public readonly name = camelize(this.model.name, true);
  public readonly description = `Retrieves one "${this.model.name}" node, throws an error if it does not exist`;

  public get graphqlFieldConfigArgs() {
    return this.model.getOperation('getIfExists').graphqlFieldConfigArgs;
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(this.model.nodeType.type);
  }

  protected async doExecute(
    args: SelectionAware<GetOneOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<GetOneOperationResult> {
    const nodeValue = await this.model.api.getIfExists<true>(
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
