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
  | 'schema'
  | 'typeDefs'
  | 'resolvers'
  | 'gateway'
  | 'status400ForVariableCoercionErrors'
>;

export class ApolloServerIntegration<
  TRequestContext extends BaseContext,
  TConnector extends core.ConnectorInterface,
  TContainer extends object,
> extends ApolloServer<TRequestContext> {
  public constructor(
    public readonly gp: core.GraphQLPlatform<
      TRequestContext,
      TConnector,
      TContainer
    >,
    options?: ApolloServerIntegrationOptions<TRequestContext>,
  ) {
    super({
      ...options,
      schema: gp.schema,
      status400ForVariableCoercionErrors: true,
    });
  }
}
