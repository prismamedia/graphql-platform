import { ApolloServer } from '@apollo/server';
import { MariaDBConnector } from '@prismamedia/graphql-platform-connector-mariadb';
import { createGraphQLPlatform } from '@prismamedia/graphql-platform-connector-mariadb/__tests__/config.js';
import {
  myAdminContext,
  MyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { ApolloServerIntegration } from './index.js';

describe('GraphQL Platform Integration Apollo Server', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = createGraphQLPlatform('integration_apollo_server');

    await gp.connector.setup();
    await gp.seed(fixtures, myAdminContext);
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it('creates an ApolloServer instance', async () => {
    const server = new ApolloServerIntegration(gp);
    expect(server).toBeInstanceOf(ApolloServer);

    await expect(
      server.executeOperation(
        {
          query: `query GetArticles($first: UnsignedInt!) {
            articles(orderBy: [createdAt_ASC], first: $first) {
              status
              title
              body
              views
              score
              machineTags
              metas
              tagCount
              tags (orderBy: [order_ASC], first: 10) {
                order
                tag {
                  title
                }
              }
              createdAt
            }
          }`,
          variables: {
            first: 10,
          },
        },
        { contextValue: myAdminContext },
      ),
    ).resolves.toMatchSnapshot();
  });
});
