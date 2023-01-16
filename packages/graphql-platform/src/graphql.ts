import type * as graphql from 'graphql';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';

export type GPBoundGraphQLFieldResolver<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TSource,
  TContext,
  TArgs = any,
  TResult = unknown,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector>,
  source: TSource,
  args: TArgs,
  context: TContext,
  info: graphql.GraphQLResolveInfo,
) => TResult;

export interface GPBoundGraphQLFieldConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TSource,
  TContext,
  TArgs = any,
  TResult = unknown,
> extends graphql.GraphQLFieldConfig<TSource, TContext, TArgs> {
  resolve?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TSource,
    TContext,
    TArgs,
    TResult
  >;
  subscribe?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TSource,
    TContext,
    TArgs,
    TResult
  >;
}
