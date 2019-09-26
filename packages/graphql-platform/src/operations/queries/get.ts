import { Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { IConnector } from '../../connector';
import { INodeValue, TWhereUniqueInputValue } from '../../node';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { NodeNotFoundError } from '../errors';
import { AbstractQuery, IQueryConfig } from './abstract-query';

export interface IGetOperationArgs extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TGetOperationResult = INodeValue;

export interface IGetOperationConfig extends IQueryConfig<IGetOperationArgs> {}

export class GetOperation extends AbstractQuery<
  IGetOperationArgs,
  TGetOperationResult,
  IGetOperationConfig
> {
  public readonly name: string = camelize(this.node.name, true);
  public readonly description = `Retrieves one "${this.node.name}" node, throws an Error if it does not exist`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IGetOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TGetOperationResult> {
    const nodeValue = await this.node
      .getOperation('getIfExists')
      .execute(args, operationContext, path);

    if (!nodeValue) {
      throw new NodeNotFoundError(this.node, args.where, path);
    }

    return nodeValue;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IGetOperationArgs> {
    return {
      where: {
        type: GraphQLNonNull(this.node.whereUniqueInput.type),
        defaultValue: this.config?.defaultArgs?.where,
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(this.node.type);
  }
}
