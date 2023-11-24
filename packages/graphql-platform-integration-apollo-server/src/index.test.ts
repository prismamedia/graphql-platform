import { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { InMemoryBroker } from '@prismamedia/graphql-platform';
import {
  createMyGP,
  type MyGP,
} from '@prismamedia/graphql-platform-connector-mariadb/__tests__/config.js';
import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { ApolloServerIntegration } from './index.js';

describe('GraphQL-Platform Integration Apollo Server', () => {
  let gp: MyGP<InMemoryBroker>;

  beforeAll(async () => {
    gp = createMyGP('integration_apollo_server', {
      subscription: { public: true },
    });

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  afterAll(() => gp.connector.teardown());

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

    await expect(
      server.executeOperation(
        {
          query: `subscription SubscribeToArticleChanges {
            articleChanges(where: { status: PUBLISHED }) {
              ... on ArticleDeletion {
                id
              }
              ... on Article {
                id
                status
                title
              }
            }
          }`,
        },
        { contextValue: myAdminContext },
      ),
    ).resolves.toMatchSnapshot();
  });
});
