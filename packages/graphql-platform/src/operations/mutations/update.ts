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

export interface IUpdateOperationArgs extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TUpdateOperationResult = INodeValue;

export interface IUpdateOperationConfig extends IMutationConfig {}

export class UpdateOperation extends AbstractMutation<
  IUpdateOperationArgs,
  TUpdateOperationResult,
  IUpdateOperationConfig
> {
  public readonly name = `update${this.node.name}`;
  public readonly description = `Updates one "${this.node.name}" node then returns it or throws an Error if it does not exist`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IUpdateOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TUpdateOperationResult> {
    const nodeValue = await this.node
      .getOperation('updateIfExists')
      .execute(args, operationContext, path);

    if (!nodeValue) {
      throw new NodeNotFoundError(this.node, args.where, path);
    }

    return nodeValue;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IUpdateOperationArgs> {
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
