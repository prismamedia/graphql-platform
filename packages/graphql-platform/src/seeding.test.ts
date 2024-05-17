import { beforeAll, describe, expect, it } from '@jest/globals';
import { myAdminContext, nodes } from './__tests__/config.js';
import { mockConnector } from './__tests__/connector-mock.js';
import * as fixtures from './__tests__/fixture.js';
import {
  EdgeExistsFilter,
  GraphQLPlatform,
  LeafComparisonFilter,
  NodeValue,
  NotOperation,
} from './index.js';
import { Seeding } from './seeding.js';

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
              parent: 'home',
              order: 0,
              title: 'ROOT',
            },
            home: {
              parent: 'root',
              order: 0,
              title: 'ROOT',
            },
          },
        }),
    ).toThrow('Dependency Cycle Found: root -> home -> root');
  });

  it('orders by dependencies', () => {
    const seeding = new Seeding(gp, fixtures.constant);

    expect(seeding.fixtures.length).toBe(15);
    expect(seeding.fixtures.map(({ reference }) => reference)).toEqual([
      'category_root',
      'category_home',
      'article_01',
      'article_02',
      'category_news',
      'user_marine',
      'tag_01',
      'tag_02',
      'user_yvann',
      'article_03',
      'tag_03',
      'article_04',
      'article_05',
      'article_06',
      'article_07',
    ]);
  });

  it('loads the fixtures', async () => {
    let hasRootCategory = false;

    const gp = new GraphQLPlatform({
      nodes,

      connector: mockConnector({
        create: async (_context, { node, creations }) => {
          switch (node.name) {
            case 'Article':
              return creations.map((creation): NodeValue => {
                switch (creation.value.title) {
                  case 'My first draft article':
                    return {
                      ...creation.value,
                      _id: 1,
                      id: 'adb64be5-650b-4332-8932-89a1943157a0',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My second draft article':
                    return {
                      ...creation.value,
                      _id: 2,
                      id: '2b13f049-9987-4d19-b7ae-357f9c2177d1',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My first published article':
                    return {
                      ...creation.value,
                      _id: 3,
                      id: 'b816e1d9-9e24-44a7-a3bb-5886e83de9d7',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My second published article':
                    return {
                      ...creation.value,
                      _id: 4,
                      id: 'bffaac46-f6dd-42c9-bc25-5d327d304ae8',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My first published article in root category':
                    return {
                      ...creation.value,
                      _id: 5,
                      id: '84d63552-d57e-4c5c-a453-0f8e9a7e034f',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My second published article in root category':
                    return {
                      ...creation.value,
                      _id: 6,
                      id: 'e260c62d-8979-4ad3-bfd9-34ea0072c191',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  case 'My third published article in root category':
                    return {
                      ...creation.value,
                      _id: 7,
                      id: '611a38b5-3af6-4cff-b47f-27479f5ba1c1',
                      body: null,
                      metas: null,
                      highlighted: null,
                      sponsored: null,
                      machineTags: null,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.value.title}"`,
                    );
                }
              });

            case 'ArticleExtension':
              return creations.map(
                (creation): NodeValue => creation.value as any,
              );

            case 'Category':
              return creations.map((creation): NodeValue => {
                switch (creation.value.title) {
                  case 'ROOT':
                    hasRootCategory = true;

                    return {
                      ...creation.value,
                      _id: 1,
                      id: '1e84dfcb-1bba-4633-ad6f-d2e2aa1b5689',
                      parent: null,
                      order: 0,
                    };

                  case 'Home':
                    return {
                      ...creation.value,
                      _id: 2,
                      id: '91966ab3-6f7d-4c48-885f-d07c98af6106',
                      parent: { _id: 1 },
                      order: 0,
                    };

                  case 'News':
                    return {
                      ...creation.value,
                      _id: 3,
                      id: 'e06a3383-aa44-410d-a1a1-72dca83b5743',
                      parent: { _id: 1 },
                      order: 1,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.value.title}"`,
                    );
                }
              });

            case 'Tag':
              return creations.map((creation): NodeValue => {
                switch (creation.value.title) {
                  case 'TV':
                    return {
                      ...creation.value,
                      id: '98aaaccb-e73e-4e9b-9aa6-383b05a15974',
                      deprecated: creation.value.deprecated ?? null,
                    };

                  case 'High-tech':
                    return {
                      ...creation.value,
                      id: 'db414952-b5e4-4a91-a013-584d10521714',
                      deprecated: creation.value.deprecated ?? null,
                    };

                  case 'Fashion':
                    return {
                      ...creation.value,
                      id: '189c1ccb-de49-484a-bcfe-50c242adf754',
                      deprecated: creation.value.deprecated ?? null,
                    };

                  default:
                    throw new Error(
                      `"create" not implemented for "${node.name}/${creation.value.title}"`,
                    );
                }
              });

            case 'ArticleTag':
              return creations.map(
                (creation): NodeValue => ({ ...creation.value }) as NodeValue,
              );

            case 'ArticleTagModeration':
              return creations.map(
                (creation): NodeValue => ({ ...creation.value }) as NodeValue,
              );

            case 'User':
              return creations.map(
                (creation): NodeValue =>
                  ({ lastLoggedInAt: null, ...creation.value }) as NodeValue,
              );

            case 'UserProfile':
              return creations.map(
                (creation): NodeValue => ({
                  birthday: null,
                  facebookId: null,
                  googleId: null,
                  twitterHandle: null,
                  ...creation.value,
                }),
              );

            default:
              throw new Error(`"create" not implemented for "${node.name}"`);
          }
        },
        count: async (_context, { node, filter }) => {
          switch (node.name) {
            case 'Category':
              if (
                filter?.filter instanceof NotOperation &&
                filter.filter.operand instanceof EdgeExistsFilter &&
                filter.filter.operand.edge.name === 'parent'
              ) {
                return hasRootCategory ? 1 : 0;
              }

            default:
              throw new Error(
                `"count" not implemented for "${node.name}/${filter?.filter.inputValue}"`,
              );
          }
        },
        find: async (
          _context,
          { node, filter, ordering, offset, limit, forMutation },
        ): Promise<any> => {
          switch (node.name) {
            case 'Article':
              return filter?.filter instanceof LeafComparisonFilter &&
                filter.filter.leaf.name === '_id'
                ? [{ _id: filter.filter.value }]
                : [];

            case 'Category':
              return filter?.filter instanceof LeafComparisonFilter &&
                filter.filter.leaf.name === '_id'
                ? [{ _id: filter.filter.value }]
                : [];

            case 'Tag':
              return filter?.filter instanceof LeafComparisonFilter &&
                filter.filter.leaf.name === 'id'
                ? [{ id: filter.filter.value }]
                : [];

            case 'ArticleTag':
              return [
                {
                  article: { _id: 3 },
                  tag: { id: 'db414952-b5e4-4a91-a013-584d10521714' },
                },
              ];

            case 'User':
              return filter?.filter instanceof LeafComparisonFilter &&
                filter.filter.leaf.name === 'id'
                ? filter.filter.value === 'c395757e-8a40-456a-b006-221ef3490456'
                  ? [{ id: filter.filter.value, username: 'yvann' }]
                  : filter.filter.value ===
                      '654173f4-8fa6-42df-9941-f5a6a4d0b97e'
                    ? [{ id: filter.filter.value, username: 'marine' }]
                    : []
                : [];

            case 'UserProfile':
              return filter?.filter instanceof EdgeExistsFilter &&
                filter.filter.edge.name === 'user' &&
                filter.filter.headFilter?.filter instanceof LeafComparisonFilter
                ? filter.filter.headFilter.filter.value ===
                  'c395757e-8a40-456a-b006-221ef3490456'
                  ? [
                      {
                        user: { id: filter.filter.headFilter.filter.value },
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
                `"find" not implemented for "${node.name}/${filter?.filter.inputValue}/${ordering?.inputValue}/${offset}/${limit}/${forMutation}"`,
              );
          }
        },
      }),
    });

    const seeding = new Seeding(gp, fixtures.constant);

    await expect(seeding.load(myAdminContext)).resolves.toBeUndefined();
  });
});
