import { Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { IConnector } from '../../connector';
import { INodeValue, TWhereUniqueInputValue } from '../../node';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { NodeNotFoundError } from '../errors';
import { AbstractMutation, IMutationConfig } from './abstract-mutation';

export interface IDeleteOperationArgs extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TDeleteOperationResult = INodeValue;

export interface IDeleteOperationConfig extends IMutationConfig {}

export class DeleteOperation extends AbstractMutation<
  IDeleteOperationArgs,
  TDeleteOperationResult,
  IDeleteOperationConfig
> {
  public readonly name = `delete${this.node.name}`;
  public readonly description = `Deletes one "${this.node.name}" node then returns it or throws an Error if it does not exist`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IDeleteOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TDeleteOperationResult> {
    const nodeValue = await this.node
      .getOperation('deleteIfExists')
      .execute(args, operationContext, path);

    if (!nodeValue) {
      throw new NodeNotFoundError(this.node, args.where, path);
    }

    return nodeValue;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IDeleteOperationArgs> {
    return {
      where: {
        type: GraphQLNonNull(this.node.whereUniqueInput.type),
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(this.node.type);
  }
}
