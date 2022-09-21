import {
  EdgeExistsFilter,
  GraphQLPlatform,
  LeafComparisonFilter,
  NotOperation,
} from './index.js';
import { Seeding } from './seeding.js';
import { myAdminContext, nodes } from './__tests__/config.js';
import { mockConnector } from './__tests__/connector-mock.js';
import { fixtures } from './__tests__/fixture.js';

describe('Seeding', () => {
  let gp: GraphQLPlatform;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('checks for circular dependencies', () => {
    expect(
      () =>
        new Seeding(gp, {
          Category: {
            root: {
              title: 'ROOT',
              parent: 'home',
            },
            home: {
              title: 'ROOT',
              parent: 'root',
            },
          },
        }),
    ).toThrowError('Dependency Cycle Found: root -> home -> root');
  });

  it('orders by dependencies', () => {
    const seeding = new Seeding(gp, fixtures);

    expect(seeding.fixturesByReference.size).toBe(16);
    expect(Array.from(seeding.fixturesByReference.keys())).toEqual([
      'category_root',
      'category_home',
      'category_news',
      'article_01',
      'article_02',
      'tag_03',
      'article_03',
      'tag_01',
      'article_03-tag_01',
      'tag_02',
      'article_03-tag_02',
      'user_yvann',
      'article_03-tag_02-moderator_user_yvann',
      'user_marine',
      'article_03-tag_02-moderator_user_marine',
      'user_profile_yvann',
    ]);
  });

  it('loads the fixtures', async () => {
    let hasRootCategory = false;

    const gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        create: async ({ node, creations }) => {
          switch (node.name) {
            case 'Article':
              return creations.map((creation) => {
                switch (creation.proxy.title) {
                  case 'My first draft article':
                    return {
                      ...creation.proxy,
                      _id: 1,
                      id: 'adb64be5-650b-4332-8932-89a1943157a0',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                    };

                  case 'My second draft article':
                    return {
                      ...creation.proxy,
                      _id: 2,
                      id: '2b13f049-9987-4d19-b7ae-357f9c2177d1',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                    };

                  case 'My first published article':
                    return {
                      ...creation.proxy,
                      _id: 3,
                      id: 'b816e1d9-9e24-44a7-a3bb-5886e83de9d7',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.proxy.title}"`,
                    );
                }
              });

            case 'Category':
              return creations.map((creation) => {
                switch (creation.proxy.title) {
                  case 'ROOT':
                    hasRootCategory = true;

                    return {
                      ...creation.proxy,
                      _id: 1,
                      id: '1e84dfcb-1bba-4633-ad6f-d2e2aa1b5689',
                      parent: null,
                      order: 0,
                    };

                  case 'Home':
                    return {
                      ...creation.proxy,
                      _id: 2,
                      id: '91966ab3-6f7d-4c48-885f-d07c98af6106',
                      parent: { _id: 1 },
                      order: 0,
                    };

                  case 'News':
                    return {
                      ...creation.proxy,
                      _id: 3,
                      id: 'e06a3383-aa44-410d-a1a1-72dca83b5743',
                      parent: { _id: 1 },
                      order: 1,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.proxy.title}"`,
                    );
                }
              });

            case 'Tag':
              return creations.map((creation) => {
                switch (creation.proxy.title) {
                  case 'TV':
                    return {
                      ...creation.proxy,
                      id: '98aaaccb-e73e-4e9b-9aa6-383b05a15974',
                      deprecated: creation.proxy.deprecated ?? null,
                    };

                  case 'high-tech':
                    return {
                      ...creation.proxy,
                      id: 'db414952-b5e4-4a91-a013-584d10521714',
                      deprecated: creation.proxy.deprecated ?? null,
                    };

                  case 'fashion':
                    return {
                      ...creation.proxy,
                      id: '189c1ccb-de49-484a-bcfe-50c242adf754',
                      deprecated: creation.proxy.deprecated ?? null,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.proxy.title}"`,
                    );
                }
              });

            case 'ArticleTag':
              return creations.map((creation) => {
                switch (creation.proxy.order) {
                  case 0:
                    return {
                      ...creation.proxy,
                      article: { _id: 3 },
                      tag: { id: '98aaaccb-e73e-4e9b-9aa6-383b05a15974' },
                    };

                  case 1:
                    return {
                      ...creation.proxy,
                      article: { _id: 3 },
                      tag: { id: 'db414952-b5e4-4a91-a013-584d10521714' },
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.proxy}"`,
                    );
                }
              });

            case 'ArticleTagModeration':
              return creations.map((creation) => ({ ...creation.proxy }));

            case 'User':
              return creations.map((creation) => ({ ...creation.proxy }));

            case 'UserProfile':
              return creations.map((creation) => ({
                birthday: null,
                facebookId: null,
                googleId: null,
                twitterHandle: null,
                ...creation.proxy,
              }));

            default:
              throw new Error(`"create" not implemented for "${node.name}"`);
          }
        },
        count: async ({ node, where }) => {
          switch (node.name) {
            case 'Category':
              if (
                where?.filter instanceof NotOperation &&
                where.filter.operand instanceof EdgeExistsFilter &&
                where.filter.operand.edge.name === 'parent'
              ) {
                return hasRootCategory ? 1 : 0;
              }

            default:
              throw new Error(
                `"count" not implemented for "${node.name}/${where?.filter.ast}"`,
              );
          }
        },
        find: async ({ node, where, orderBy, offset, limit, forMutation }) => {
          switch (node.name) {
            case 'Article':
              return where?.filter instanceof LeafComparisonFilter &&
                where.filter.leaf.name === '_id'
                ? [{ _id: where.filter.value }]
                : [];

            case 'Category':
              return where?.filter instanceof LeafComparisonFilter &&
                where.filter.leaf.name === '_id'
                ? [{ _id: where.filter.value }]
                : [];

            case 'Tag':
              return where?.filter instanceof LeafComparisonFilter &&
                where.filter.leaf.name === 'id'
                ? [{ id: where.filter.value }]
                : [];

            case 'ArticleTag':
              return [
                {
                  article: { _id: 3 },
                  tag: { id: 'db414952-b5e4-4a91-a013-584d10521714' },
                },
              ];

            case 'User':
              return where?.filter instanceof LeafComparisonFilter &&
                where.filter.leaf.name === 'id'
                ? where.filter.value === 'c395757e-8a40-456a-b006-221ef3490456'
                  ? [{ id: where.filter.value, username: 'yvann' }]
                  : where.filter.value ===
                    '654173f4-8fa6-42df-9941-f5a6a4d0b97e'
                  ? [{ id: where.filter.value, username: 'marine' }]
                  : []
                : [];

            case 'UserProfile':
              return where?.filter instanceof EdgeExistsFilter &&
                where.filter.edge.name === 'user' &&
                where.filter.headFilter?.filter instanceof LeafComparisonFilter
                ? where.filter.headFilter.filter.value ===
                  'c395757e-8a40-456a-b006-221ef3490456'
                  ? [
                      {
                        user: { id: where.filter.headFilter.filter.value },
                        birthday: '1987-04-28',
                        facebookId: null,
                        googleId: null,
                        twitterHandle: '@yvannboucher',
                      },
                    ]
                  : []
                : [];

            default:
              throw new Error(
                `"find" not implemented for "${node.name}/${where?.filter.ast}/${orderBy?.ast}/${offset}/${limit}/${forMutation}"`,
              );
          }
        },
      }),
    });

    const seeding = new Seeding(gp, fixtures);

    await expect(seeding.load(myAdminContext)).resolves.toBeUndefined();
  });
});
