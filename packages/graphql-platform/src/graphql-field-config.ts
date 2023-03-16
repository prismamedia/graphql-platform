import type * as graphql from 'graphql';
import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';

export type GPBoundGraphQLFieldResolver<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TContainer>,
  source: TSource,
  args: TArgs,
  context: TRequestContext,
  info: graphql.GraphQLResolveInfo,
) => Promisable<TResult>;

export interface GPBoundGraphQLFieldConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> extends graphql.GraphQLFieldConfig<TSource, TRequestContext, TArgs> {
  resolve?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
  subscribe?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
}
