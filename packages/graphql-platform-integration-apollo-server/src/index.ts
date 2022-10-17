import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import type { GraphQLPlatform } from '@prismamedia/graphql-platform';

export class ApolloServerIntegration<
  in out TRequestContext extends BaseContext = BaseContext,
> extends ApolloServer<TRequestContext> {
  public constructor(
    gp: GraphQLPlatform<TRequestContext>,
    options?: Omit<
      ApolloServerOptions<TRequestContext>,
      'schema' | 'typeDefs' | 'resolvers' | 'gateway'
    >,
  ) {
    super({ ...options, schema: gp.schema });
  }
}
