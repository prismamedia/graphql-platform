import {
  BaseContext as CoreBaseContext,
  CustomContext,
  CustomOperationConfig as CoreCustomOperationConfig,
  GraphQLPlatform as CoreGraphQLPlatform,
  GraphQLPlatformConfig as CoreGraphQLPlatformConfig,
} from '@prismamedia/graphql-platform-core';
import { Maybe, POJO } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { Connector, ConnectorConfig, ConnectorRequest } from './graphql-platform/connector';
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

export type CustomOperationConfig<TCustomContext extends CustomContext = {}> = CoreCustomOperationConfig<
  TCustomContext,
  BaseContext
>;

export interface GraphQLPlatformConfig<TContextParams extends POJO = any, TCustomContext extends CustomContext = {}>
  extends CoreGraphQLPlatformConfig<TContextParams, TCustomContext, BaseContext, ResourceConfig<TCustomContext>> {
  connector?: Maybe<ConnectorConfig>;
}

export class GraphQLPlatform<
  TContextParams extends POJO = any,
  TCustomContext extends CustomContext = {}
> extends CoreGraphQLPlatform<TContextParams, TCustomContext, GraphQLPlatformConfig<TContextParams, TCustomContext>> {
  @Memoize()
  public getConnector(): Connector {
    return new Connector(this.config.connector, this);
  }

  public async getBaseContext(): Promise<BaseContext> {
    return {
      ...(await super.getBaseContext()),
      connector: this.getConnector(),
      connectorRequest: this.getConnector().newRequest(),
    };
  }
}
