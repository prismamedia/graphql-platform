import Scalars from '@prismamedia/graphql-platform-scalars';
import { addPath, Path } from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { ConnectorInterface } from '../../../connector';
import { WhereInputValue } from '../../types/inputs/where';
import { SelectionAware } from '../abstract';
import { OperationContext } from '../context';
import { AbstractQuery } from './abstract';

export type CountOperationArgs =
  | {
      where?: WhereInputValue;
    }
  | undefined;

export type CountOperationResult = number;

export class CountOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  CountOperationArgs,
  CountOperationResult
> {
  public readonly name: string = `${camelize(this.model.name, true)}Count`;
  public readonly description = `Gets the number of "${this.model.name}" nodes`;

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: this.model.whereInputType.type,
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(Scalars.PositiveInt);
  }

  protected async doExecute(
    args: SelectionAware<CountOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<CountOperationResult> {
    const argsPath = addPath(path, 'args');

    const contextualizedFilter = await this.model.getContextualizedFilter(
      args?.where,
      operationContext,
      addPath(argsPath, 'where'),
    );

    return contextualizedFilter.kind === 'Boolean' &&
      !contextualizedFilter.value
      ? // In case of a "false" filter, we can save a connector call
        0
      : this.connector.count(
          this.model,
          !(
            contextualizedFilter.kind === 'Boolean' &&
            contextualizedFilter.value
          )
            ? { filter: contextualizedFilter }
            : undefined,
          operationContext,
        );
  }
}
