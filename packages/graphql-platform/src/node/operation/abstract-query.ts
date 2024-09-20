import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { CamelCase } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';
import { OperationContext } from './context.js';

export abstract class AbstractQuery<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
> extends AbstractOperation<
  TRequestContext,
  TConnector,
  TBroker,
  TContainer,
  OperationContext<TRequestContext, TConnector, TBroker, TContainer>,
  TArgs,
  Promise<TResult>
> {
  public readonly operationType = graphql.OperationTypeNode.QUERY;

  @Memoize()
  public get method(): CamelCase<this['key']> {
    return this.key.replaceAll(/((?:-).)/g, ([_match, letter]) =>
      letter.toUpperCase(),
    ) as any;
  }

  public override async execute(
    requestOrOperationContext: TRequestContext | OperationContext,
    args: TArgs,
    path?: utils.Path,
  ): Promise<TResult> {
    return requestOrOperationContext instanceof OperationContext
      ? super.execute(requestOrOperationContext, args, path)
      : this.gp.withOperationContext(
          requestOrOperationContext,
          (context) => super.execute(context, args, path),
          path,
        );
  }

  protected getGraphQLFieldConfigSubscriber(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['subscribe'] {
    return undefined;
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return async (_, args, context, info) => {
      try {
        return await this.execute(
          context,
          (this.selectionAware ? { ...args, selection: info } : args) as TArgs,
          info.path,
        );
      } catch (error) {
        throw error instanceof utils.GraphError
          ? error.toGraphQLError()
          : error;
      }
    };
  }
}
