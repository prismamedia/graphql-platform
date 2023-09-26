import * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { BrokerInterface } from './broker-interface.js';
import type { ConnectorInterface } from './connector-interface.js';
import type { GPBoundGraphQLFieldConfig } from './graphql-field-config.js';
import type { GraphQLPlatform } from './index.js';

export interface CustomOperationConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TArgs = any,
  TResult = unknown,
> extends GPBoundGraphQLFieldConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    undefined,
    TArgs,
    TResult
  > {}

export type ThunkableNillableCustomOperation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TArgs = any,
  TResult = unknown,
> = utils.Thunkable<
  utils.Nillable<
    CustomOperationConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer,
      TArgs,
      TResult
    >
  >,
  [gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>]
>;

export type CustomOperationsByNameConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  utils.Nillable<{
    [operationName: utils.Name]: ThunkableNillableCustomOperation<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >;
  }>,
  [gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>]
>;

export type CustomOperationsByNameByTypeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  utils.Nillable<{
    [operationType in graphql.OperationTypeNode]?: CustomOperationsByNameConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >;
  }>,
  [gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>]
>;

export function getCustomOperationsByNameByType<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>,
  operationType: graphql.OperationTypeNode,
  config: CustomOperationsByNameByTypeConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >,
  configPath: utils.Path,
): graphql.GraphQLFieldConfigMap<undefined, TRequestContext> {
  const fields: graphql.GraphQLFieldConfigMap<any, any> = {};

  const customOperationsByNameByType = utils.resolveThunkable(config, gp);

  utils.assertNillablePlainObject(customOperationsByNameByType, configPath);

  if (customOperationsByNameByType) {
    const customOperationsByName = utils.resolveThunkable(
      customOperationsByNameByType[operationType],
      gp,
    );
    const customOperationsByNamePath = utils.addPath(configPath, operationType);

    utils.assertNillablePlainObject(
      customOperationsByName,
      customOperationsByNamePath,
    );

    if (customOperationsByName) {
      utils.aggregateGraphError<
        [utils.Name, ThunkableNillableCustomOperation],
        void
      >(
        Object.entries(customOperationsByName),
        (_, [operationName, thunkableNillableCustomOperation]) => {
          const customOperation = utils.resolveThunkable(
            thunkableNillableCustomOperation,
            gp,
          );
          const customOperationPath = utils.addPath(
            customOperationsByNamePath,
            operationName,
          );

          utils.assertNillablePlainObject(customOperation, customOperationPath);

          if (customOperation) {
            fields[operationName] = {
              ...customOperation,
              ...(customOperation.resolve && {
                resolve: customOperation.resolve.bind(gp),
              }),
              ...(customOperation.subscribe && {
                subscribe: customOperation.subscribe.bind(gp),
              }),
            };
          }
        },
        undefined,
        { path: customOperationsByNamePath },
      );
    }
  }

  return fields;
}
