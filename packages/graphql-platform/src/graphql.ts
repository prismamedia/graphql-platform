import type * as graphql from 'graphql';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';

export type GPBoundGraphQLFieldResolver<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TSource,
  TArgs = any,
  TResult = unknown,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector>,
  source: TSource,
  args: TArgs,
  context: TRequestContext,
  info: graphql.GraphQLResolveInfo,
) => TResult;

export interface GPBoundGraphQLFieldConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TSource,
  TArgs = any,
  TResult = unknown,
> extends graphql.GraphQLFieldConfig<TSource, TRequestContext, TArgs> {
  resolve?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TSource,
    TArgs,
    TResult
  >;
}
