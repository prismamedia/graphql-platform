import Scalars from '@prismamedia/graphql-platform-scalars';
import { addPath, Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { IConnector } from '../../connector';
import { TWhereInputValue } from '../../node';
import {
  ISelectionsUnawareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { AbstractQuery, IQueryConfig } from './abstract-query';

export interface ICountOperationArgs extends ISelectionsUnawareOperationArgs {
  readonly where?: TWhereInputValue;
}

export type TCountOperationResult = number;

export interface ICountOperationConfig
  extends IQueryConfig<ICountOperationArgs> {}

export class CountOperation extends AbstractQuery<
  ICountOperationArgs,
  TCountOperationResult,
  ICountOperationConfig
> {
  public readonly name: string = `${camelize(this.node.name, true)}Count`;
  public readonly description = `Gets the number of "${this.node.name}" nodes`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<ICountOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TCountOperationResult> {
    const { where } = {
      ...this.config?.defaultArgs,
      ...args,
    };

    const contextualizedFilter = await this.node.getContextualizedFilter(
      where,
      operationContext.context,
      addPath(path, 'where'),
    );

    return contextualizedFilter.kind === 'Boolean' &&
      !contextualizedFilter.value
      ? // In case of a "false" filter, we can save a request
        0
      : operationContext.connector.count(
          this.node,
          { filter: contextualizedFilter },
          operationContext,
        );
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<ICountOperationArgs> {
    return {
      where: {
        type: this.node.whereInput.type,
        defaultValue: this.config?.defaultArgs?.where,
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(Scalars.NonNegativeInt);
  }
}
