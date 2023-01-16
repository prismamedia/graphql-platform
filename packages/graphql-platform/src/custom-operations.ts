import type * as graphql from 'graphql';
import type { ConnectorInterface } from './connector-interface.js';
import type { GPBoundGraphQLFieldConfig } from './graphql.js';
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

export type CustomOperation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs = any,
  TResult = unknown,
> = GPBoundGraphQLFieldConfig<
  TRequestContext,
  TConnector,
  undefined,
  TArgs,
  TResult
>;

type CustomOperationTypeMap<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  [operationName: string]: MaybeGraphQLPlatformAware<
    TRequestContext,
    TConnector,
    CustomOperation<TRequestContext, TConnector> | undefined
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
        fieldConfigMap[operationName] = {
          ...operation,
          resolve: operation.resolve?.bind(gp),
          subscribe: operation.subscribe?.bind(gp),
        };
      }
    }
  }

  return fieldConfigMap;
}
