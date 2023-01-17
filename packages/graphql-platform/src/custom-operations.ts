import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { ConnectorInterface } from './connector-interface.js';
import type { GPBoundGraphQLFieldConfig } from './graphql-field-config.js';
import type { GraphQLPlatform } from './index.js';
import {
  resolveMaybeGPAwareConfig,
  type MaybeGPAwareConfig,
} from './maybe-aware-config.js';

export interface CustomOperationConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TArgs = any,
  TResult = unknown,
> extends GPBoundGraphQLFieldConfig<
    TRequestContext,
    TConnector,
    undefined,
    TArgs,
    TResult
  > {}

export type CustomOperationsByNameConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = Partial<
  Record<
    utils.Name,
    MaybeGPAwareConfig<
      TRequestContext,
      TConnector,
      CustomOperationConfig<TRequestContext, TConnector> | undefined
    >
  >
>;

export type CustomOperationsByNameByTypeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = Partial<
  Record<
    graphql.OperationTypeNode,
    MaybeGPAwareConfig<
      TRequestContext,
      TConnector,
      CustomOperationsByNameConfig<TRequestContext, TConnector> | undefined
    >
  >
>;

export function getCustomOperationsByNameByType<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
  maybeConfig:
    | CustomOperationsByNameByTypeConfig<TRequestContext, TConnector>
    | undefined,
  operationType: graphql.OperationTypeNode,
): graphql.GraphQLFieldConfigMap<undefined, TRequestContext> {
  const customOperationsByName: graphql.GraphQLFieldConfigMap<any, any> = {};

  const maybeCustomOperationsByName = resolveMaybeGPAwareConfig(
    gp,
    maybeConfig?.[operationType],
  );

  if (maybeCustomOperationsByName) {
    for (const [operationName, maybeCustomOperationConfig] of Object.entries(
      maybeCustomOperationsByName,
    )) {
      const maybeCustomOperation = resolveMaybeGPAwareConfig(
        gp,
        maybeCustomOperationConfig,
      );

      if (maybeCustomOperation) {
        customOperationsByName[operationName] = {
          ...maybeCustomOperation,
          ...(maybeCustomOperation.resolve && {
            resolve: maybeCustomOperation.resolve.bind(gp),
          }),
          ...(maybeCustomOperation.subscribe && {
            subscribe: maybeCustomOperation.subscribe.bind(gp),
          }),
        };
      }
    }
  }

  return customOperationsByName;
}
