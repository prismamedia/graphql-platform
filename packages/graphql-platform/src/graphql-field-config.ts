import type * as graphql from 'graphql';
import type { Promisable } from 'type-fest';
import type { BrokerInterface } from './broker-interface.js';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';
import type { Node } from './node.js';

export type GPBoundGraphQLFieldResolver<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>,
  source: TSource,
  args: TArgs,
  context: TRequestContext,
  info: graphql.GraphQLResolveInfo,
) => Promisable<TResult>;

export interface GPBoundGraphQLFieldConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> extends graphql.GraphQLFieldConfig<TSource, TRequestContext, TArgs> {
  resolve?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
  subscribe?: GPBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
}

export type NodeBoundGraphQLFieldResolver<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> = (
  this: Node<TRequestContext, TConnector, TBroker, TContainer>,
  source: TSource,
  args: TArgs,
  context: TRequestContext,
  info: graphql.GraphQLResolveInfo,
) => Promisable<TResult>;

export interface NodeBoundGraphQLFieldConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
  TSource,
  TArgs = any,
  TResult = unknown,
> extends graphql.GraphQLFieldConfig<TSource, TRequestContext, TArgs> {
  resolve?: NodeBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
  subscribe?: NodeBoundGraphQLFieldResolver<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    TSource,
    TArgs,
    TResult
  >;
}
