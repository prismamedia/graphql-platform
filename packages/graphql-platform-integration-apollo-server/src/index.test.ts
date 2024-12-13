import { ApolloServer } from '@apollo/server';
import type { InMemoryBroker } from '@prismamedia/graphql-platform';
import {
  createMyGP,
  type MyGP,
} from '@prismamedia/graphql-platform-connector-mariadb/__tests__/config.js';
import { myAdminContext } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { ApolloServerIntegration } from './index.js';

describe('GraphQL-Platform Integration Apollo Server', () => {
  let gp: MyGP<InMemoryBroker>;

  before(async () => {
    gp = createMyGP('integration_apollo_server', {
      subscription: { public: true },
    });

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  after(() => gp.connector.teardown());

  it('creates an ApolloServer instance', async (t) => {
    const server = new ApolloServerIntegration(gp);
    assert(server instanceof ApolloServer);

    await Promise.all([
      t.test('find articles', async () => {
        const articlesQuery = await server.executeOperation(
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
                lowerCasedTitle
                similars(first: $first) {
                  title
                  similars(first: $first) {
                    title
                  }
                }
              }
            }`,
            variables: {
              first: 10,
            },
          },
          { contextValue: myAdminContext },
        );

        assert.deepEqual(articlesQuery.body, {
          kind: 'single',
          singleResult: {
            data: {
              articles: [
                {
                  body: {
                    blocks: [],
                    entityMap: {},
                  },
                  createdAt: '2022-01-01T00:00:00.000Z',
                  lowerCasedTitle: 'draft-my first draft article-home',
                  machineTags: null,
                  metas: {
                    myArbitraryKey: 'with my arbitrary value',
                  },
                  score: 0.5,
                  similars: [],
                  status: 'DRAFT',
                  tagCount: 0,
                  tags: [],
                  title: 'My first draft article',
                  views: '0',
                },
                {
                  body: null,
                  createdAt: '2022-02-01T00:00:00.000Z',
                  lowerCasedTitle: 'draft-my second draft article-home',
                  machineTags: null,
                  metas: null,
                  score: 0.5,
                  similars: [],
                  status: 'DRAFT',
                  tagCount: 0,
                  tags: [],
                  title: 'My second draft article',
                  views: '0',
                },
                {
                  body: null,
                  createdAt: '2022-03-01T00:00:00.000Z',
                  lowerCasedTitle: 'published-my first published article-news',
                  machineTags: null,
                  metas: null,
                  score: 0.5,
                  similars: [],
                  status: 'PUBLISHED',
                  tagCount: 2,
                  tags: [
                    {
                      order: 0,
                      tag: {
                        title: 'TV',
                      },
                    },
                    {
                      order: 1,
                      tag: {
                        title: 'High-tech',
                      },
                    },
                  ],
                  title: 'My first published article',
                  views: '0',
                },
                {
                  body: {
                    blocks: [],
                    entityMap: {},
                  },
                  createdAt: '2022-04-01T00:00:00.000Z',
                  lowerCasedTitle: 'published-my second published article-home',
                  machineTags: [
                    'namespace:key=a_value',
                    'namespace:key=other_value',
                  ],
                  metas: {
                    aKey: 'withAnyValue',
                  },
                  score: 0.12,
                  similars: [],
                  status: 'PUBLISHED',
                  tagCount: 1,
                  tags: [
                    {
                      order: 0,
                      tag: {
                        title: 'Fashion',
                      },
                    },
                  ],
                  title: 'My second published article',
                  views: '1234567890',
                },
                {
                  body: null,
                  createdAt: '2022-05-01T00:00:00.000Z',
                  lowerCasedTitle:
                    'published-my first published article in root category-root',
                  machineTags: null,
                  metas: null,
                  score: 0.5,
                  similars: [],
                  status: 'PUBLISHED',
                  tagCount: 3,
                  tags: [
                    {
                      order: 0,
                      tag: {
                        title: 'TV',
                      },
                    },
                    {
                      order: 1,
                      tag: {
                        title: 'High-tech',
                      },
                    },
                    {
                      order: 2,
                      tag: {
                        title: 'Fashion',
                      },
                    },
                  ],
                  title: 'My first published article in root category',
                  views: '0',
                },
                {
                  body: null,
                  createdAt: '2022-06-01T00:00:00.000Z',
                  lowerCasedTitle:
                    'published-my second published article in root category-root',
                  machineTags: null,
                  metas: null,
                  score: 0.5,
                  similars: [],
                  status: 'PUBLISHED',
                  tagCount: 2,
                  tags: [
                    {
                      order: 0,
                      tag: {
                        title: 'TV',
                      },
                    },
                    {
                      order: 1,
                      tag: {
                        title: 'Fashion',
                      },
                    },
                  ],
                  title: 'My second published article in root category',
                  views: '0',
                },
                {
                  body: null,
                  createdAt: '2022-07-01T00:00:00.000Z',
                  lowerCasedTitle:
                    'published-my third published article in root category-root',
                  machineTags: null,
                  metas: null,
                  score: 0.5,
                  similars: [],
                  status: 'PUBLISHED',
                  tagCount: 0,
                  tags: [],
                  title: 'My third published article in root category',
                  views: '0',
                },
              ],
            },
            errors: undefined,
          },
        });
      }),
      t.test('scroll articles', async () => {
        const articleScrollSubscription = await server.executeOperation(
          {
            query: `subscription ArticleScroll {
              articles(where: { status: PUBLISHED }) {
                id
                status
                title
                lowerCasedTitle
              }
            }`,
          },
          { contextValue: myAdminContext },
        );

        assert.deepEqual(articleScrollSubscription.body, {
          kind: 'single',
          singleResult: {
            data: {
              articles: null,
            },
            errors: undefined,
          },
        });
      }),
      t.test('article changes', async () => {
        const articleChangesSubscription = await server.executeOperation(
          {
            query: `subscription ArticleChanges {
              articleChanges(where: { status: PUBLISHED }) {
                ... on ArticleDeletion {
                  id
                }
                ... on Article {
                  id
                  status
                  title
                  lowerCasedTitle
                }
              }
            }`,
          },
          { contextValue: myAdminContext },
        );

        assert.deepEqual(articleChangesSubscription.body, {
          kind: 'single',
          singleResult: {
            data: {
              articleChanges: null,
            },
            errors: undefined,
          },
        });
      }),
    ]);
  });
});
