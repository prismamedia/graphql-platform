import { AnyGraphQLPlatform } from '@prismamedia/graphql-platform-core';
import { Merge } from '@prismamedia/graphql-platform-utils';
import {
  ApolloServer,
  ApolloServerExpressConfig as BaseApolloServerExpressConfig,
  ServerRegistration as BaseServerRegistration,
} from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import express from 'express';
import expressJwt, { Options as JwtOptions } from 'express-jwt';
import { Options as UnlessOptions } from 'express-unless';

export type ContextParams<TUser = any> = ExpressContext & {
  req: {
    // This property's name can be configured with the "jwt.requestProperty" option
    user?: TUser;
  };
};

// The "app" becomes optional
type ServerRegistration = Merge<
  BaseServerRegistration,
  {
    app?: express.Application;
    jwt?: JwtOptions & { unless?: UnlessOptions };
  }
>;

// We omit everything provided by the GraphQL Platform
type ApolloServerExpressConfig = Omit<
  BaseApolloServerExpressConfig,
  'context' | 'schema' | 'subscriptions' | 'resolvers' | 'typeDefs'
>;

export type GraphQLPlatformServerExpressConfig = { gp: AnyGraphQLPlatform } & ServerRegistration &
  ApolloServerExpressConfig;

export function createServer({
  gp,
  app = express(),
  // ServerRegistration
  cors,
  disableHealthCheck,
  jwt,
  onHealthCheck,
  path = '/',
  // ApolloServerExpressConfig
  formatResponse,
  introspection = true,
  playground = true,
  tracing = true,
  uploads = true,
  ...config
}: GraphQLPlatformServerExpressConfig) {
  const server = new ApolloServer({
    // We plug the GraphQL Platform here
    schema: gp.getGraphQLSchema(),
    context: gp.getContext.bind(gp),
    introspection,
    playground,
    tracing,
    uploads,
    formatResponse: ({ errors, ...rest }: any) => {
      const referenceSet = new WeakSet();

      // Errors without circular references
      const safeErrors =
        Array.isArray(errors) && errors.length > 0
          ? JSON.parse(
              JSON.stringify(errors, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                  if (referenceSet.has(value)) {
                    return;
                  }

                  referenceSet.add(value);
                }

                return value;
              }),
            )
          : undefined;

      const response = {
        errors: safeErrors,
        ...rest,
      };

      return formatResponse ? formatResponse(response) : response;
    },
    ...config,
  });

  server.applyMiddleware({
    app,
    cors,
    disableHealthCheck,
    onHealthCheck,
    path,
  });

  if (jwt) {
    const { unless = {}, requestProperty = 'user', ...config } = jwt;

    app.use(
      expressJwt({
        requestProperty,
        ...config,
      }).unless(unless),
    );
  }

  return app;
}
