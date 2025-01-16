import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createMyGP } from '@prismamedia/graphql-platform-connector-mariadb/__tests__/config.js';
import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { ApolloServerIntegration } from '../index.js';

const gp = createMyGP('expressjs_integration_apollo_server', {
  subscription: { public: true },
});
await gp.connector.setup();
await gp.seed(myAdminContext, fixtures.constant);

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/',
});

const wsServerCleanup = useServer(
  { schema: gp.schema, context: async () => myAdminContext },
  wsServer,
);

const server = new ApolloServerIntegration(gp, {
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsServerCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

app.use(
  '/',
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  expressMiddleware(server, { context: async () => myAdminContext }),
);

httpServer.listen({ port: 3000 });
