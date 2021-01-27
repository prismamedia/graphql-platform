import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  OperationTypeNode,
} from 'graphql';
import { ConnectorInterface, GraphQLPlatform } from '.';

type MaybeGraphQLPlatformAware<TConnector extends ConnectorInterface, T> =
  | T
  | ((gp: GraphQLPlatform<any, TConnector>) => T);

const resolveMaybeGraphQLPlatformAware = <
  TConnector extends ConnectorInterface,
  T,
>(
  gp: GraphQLPlatform<any, TConnector>,
  config?: MaybeGraphQLPlatformAware<TConnector, T>,
): T | undefined =>
  config
    ? ((typeof config === 'function' ? (config as any)(gp) : config) as T)
    : undefined;

type CustomOperationTypeMap<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = {
  [operationName: string]: MaybeGraphQLPlatformAware<
    TConnector,
    GraphQLFieldConfig<undefined, TRequestContext, any> | undefined
  >;
};

export type CustomOperationMap<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = {
  [operationType in OperationTypeNode]?: MaybeGraphQLPlatformAware<
    TConnector,
    CustomOperationTypeMap<TRequestContext, TConnector> | undefined
  >;
};

export function getCustomOperationMap<
  TRequestContext,
  TConnector extends ConnectorInterface,
>(
  gp: GraphQLPlatform<any, TConnector>,
  config: CustomOperationMap<TRequestContext, TConnector> | undefined,
  operationType: OperationTypeNode,
): GraphQLFieldConfigMap<undefined, TRequestContext> {
  const fieldConfigMap: GraphQLFieldConfigMap<any, any> = {};

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
