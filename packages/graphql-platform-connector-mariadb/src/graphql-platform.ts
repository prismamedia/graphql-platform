import {
  BaseContext as CoreBaseContext,
  Context as CoreContext,
  CustomContext,
  CustomOperationConfig as CoreCustomOperationConfig,
  GraphQLPlatform as CoreGraphQLPlatform,
  GraphQLPlatformConfig as CoreGraphQLPlatformConfig,
} from '@prismamedia/graphql-platform-core';
import { Maybe, POJO } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  Connector,
  ConnectorConfig,
  ConnectorRequest,
} from './graphql-platform/connector';
import { ResourceConfig } from './graphql-platform/resource';

export * from './graphql-platform/connector';
export * from './graphql-platform/resource';

/** "Context" provided by the GraphQL Platform */
export type BaseContext = CoreBaseContext & {
  /**
   * Use the "Connector" at your own risk as you can do whatever you want with the database
   */
  connector: Connector;

  /**
   * A new "ConnectorRequest" is created for every GraphQL execution's context, it is a convenient place
   * to share a state/cache between all the resolvers of the same request
   */
  connectorRequest: ConnectorRequest;
};

export type AnyBaseContext = BaseContext;

export type Context<TCustomContext extends CustomContext = {}> = CoreContext<
  TCustomContext,
  BaseContext
>;

export type CustomOperationConfig<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = {}
> = CoreCustomOperationConfig<TArgs, TCustomContext, BaseContext>;

export interface GraphQLPlatformConfig<
  TContextParams extends POJO = any,
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext
> extends CoreGraphQLPlatformConfig<
    TContextParams,
    TCustomContext,
    TBaseContext,
    ResourceConfig<TCustomContext, TBaseContext>
  > {
  connector?: Maybe<ConnectorConfig>;
}

export class GraphQLPlatform<
  TContextParams extends POJO = any,
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext
> extends CoreGraphQLPlatform<
  TContextParams,
  TCustomContext,
  TBaseContext,
  GraphQLPlatformConfig<TContextParams, TCustomContext, TBaseContext>
> {
  @Memoize()
  public getConnector(): Connector {
    return new Connector(this.config.connector, this);
  }

  public async getBaseContext(): Promise<TBaseContext> {
    return {
      ...(await super.getBaseContext()),
      connector: this.getConnector(),
      connectorRequest: this.getConnector().newRequest(),
    };
  }
}
