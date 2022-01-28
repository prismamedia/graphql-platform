import * as graphql from 'graphql';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';

type MaybeGraphQLPlatformAware<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  T,
> = T | ((gp: GraphQLPlatform<TRequestContext, TConnector>) => T);

const resolveMaybeGraphQLPlatformAware = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  T,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
  config?: MaybeGraphQLPlatformAware<TRequestContext, TConnector, T>,
): T | undefined =>
  config
    ? ((typeof config === 'function' ? (config as any)(gp) : config) as T)
    : undefined;

type CustomOperationTypeMap<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  [operationName: string]: MaybeGraphQLPlatformAware<
    TRequestContext,
    TConnector,
    graphql.GraphQLFieldConfig<undefined, TRequestContext, any> | undefined
  >;
};

export type CustomOperationMap<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = {
  [operationType in graphql.OperationTypeNode]?: MaybeGraphQLPlatformAware<
    TRequestContext,
    TConnector,
    CustomOperationTypeMap<TRequestContext, TConnector> | undefined
  >;
};

export function getCustomOperationMap<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
  config: CustomOperationMap<TRequestContext, TConnector> | undefined,
  operationType: graphql.OperationTypeNode,
): graphql.GraphQLFieldConfigMap<undefined, TRequestContext> {
  const fieldConfigMap: graphql.GraphQLFieldConfigMap<any, any> = {};

  const customOperations = resolveMaybeGraphQLPlatformAware(
    gp,
    config?.[operationType],
  );

  if (customOperations) {
    for (const [operationName, maybeGraphQLFieldConfig] of Object.entries(
      customOperations,
    )) {
      const operation = resolveMaybeGraphQLPlatformAware(
        gp,
        maybeGraphQLFieldConfig,
      );

      if (operation) {
        fieldConfigMap[operationName] = operation;
      }
    }
  }

  return fieldConfigMap;
}
