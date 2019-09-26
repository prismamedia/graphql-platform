import { addPath, Path } from '@prismamedia/graphql-platform-utils';
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
import { AbstractQuery, IQueryConfig } from './abstract-query';

export interface IGetIfExistsOperationArgs
  extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TGetIfExistsOperationResult = INodeValue | null;

export interface IGetIfExistsOperationConfig
  extends IQueryConfig<IGetIfExistsOperationArgs> {}

export class GetIfExistsOperation extends AbstractQuery<
  IGetIfExistsOperationArgs,
  TGetIfExistsOperationResult,
  IGetIfExistsOperationConfig
> {
  public readonly name: string = `${camelize(this.node.name, true)}IfExists`;
  public readonly description = `Retrieves one "${this.node.name}" node, returns null if it does not exist`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IGetIfExistsOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TGetIfExistsOperationResult> {
    const { where, selections } = {
      ...this.config?.defaultArgs,
      ...args,
    };

    const [nodeValue = null] = await this.node.getOperation('find').execute(
      {
        where: this.node.whereUniqueInput.parseValue(
          where,
          addPath(path, 'where'),
        ),
        orderBy: [],
        first: 1,
        selections,
      },
      operationContext,
      path,
    );

    return nodeValue;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IGetIfExistsOperationArgs> {
    return {
      where: {
        type: GraphQLNonNull(this.node.whereUniqueInput.type),
        defaultValue: this.config?.defaultArgs?.where,
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return this.node.type;
  }
}
