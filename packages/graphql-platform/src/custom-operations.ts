import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  OperationTypeNode,
} from 'graphql';
import { GraphQLPlatform, IConnector } from '.';

export type TMaybeGraphQLPlatformAware<TConnector extends IConnector, T> =
  | T
  | ((gp: GraphQLPlatform<any, TConnector>) => T);

export const getMaybeGraphQLPlatformAware = <TConnector extends IConnector, T>(
  gp: GraphQLPlatform<any, TConnector>,
  config?: TMaybeGraphQLPlatformAware<TConnector, T>,
): T | undefined =>
  config
    ? ((typeof config === 'function' ? (config as any)(gp) : config) as T)
    : undefined;

export type TCustomOperationTypeMap<TContext, TConnector extends IConnector> = {
  [operationName: string]: TMaybeGraphQLPlatformAware<
    TConnector,
    GraphQLFieldConfig<undefined, TContext, any> | undefined
  >;
};

export type TCustomOperationMap<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> = {
  [operationType in OperationTypeNode]?: TMaybeGraphQLPlatformAware<
    TConnector,
    TCustomOperationTypeMap<TContext, TConnector> | undefined
  >;
};

export function getCustomOperationMap<TContext, TConnector extends IConnector>(
  gp: GraphQLPlatform<any, TConnector>,
  config: TCustomOperationMap<TContext, TConnector> | undefined,
  operationType: OperationTypeNode,
): GraphQLFieldConfigMap<undefined, TContext> {
  const fieldConfigMap: GraphQLFieldConfigMap<any, any> = {};

  const customOperations = getMaybeGraphQLPlatformAware(
    gp,
    config?.[operationType],
  );

  if (customOperations) {
    for (const [operationName, maybeGraphQLFieldConfig] of Object.entries(
      customOperations,
    )) {
      const operation = getMaybeGraphQLPlatformAware(
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
