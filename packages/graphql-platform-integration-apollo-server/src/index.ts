import {
  ApolloServer,
  type ApolloServerOptions,
  type BaseContext,
} from '@apollo/server';
import type * as core from '@prismamedia/graphql-platform';

export type ApolloServerIntegrationOptions<
  TRequestContext extends BaseContext = any,
> = Omit<
  ApolloServerOptions<TRequestContext>,
  'schema' | 'typeDefs' | 'resolvers' | 'gateway'
>;

export class ApolloServerIntegration<
  TRequestContext extends BaseContext = any,
  TConnector extends core.ConnectorInterface = any,
> extends ApolloServer<TRequestContext> {
  public constructor(
    public readonly gp: core.GraphQLPlatform<TRequestContext, TConnector>,
    options?: ApolloServerIntegrationOptions<TRequestContext>,
  ) {
    super({
      ...options,
      schema: gp.schema,
    });
  }
}
