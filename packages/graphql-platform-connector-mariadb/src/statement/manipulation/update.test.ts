import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  myAdminContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import * as R from 'remeda';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Update statement', () => {
  let gp: MyGP;

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_update_statement`);

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  afterAll(() => gp.connector.teardown());

  it.each([
    [
      'Article',
      myAdminContext,
      {
        data: {
          score: 0,
          status: ArticleStatus.DELETED,
          tags: {
            deleteAll: true,
          },
          metas: null,
          machineTags: null,
          updatedAt: new Date('2022-06-01T00:00:00Z'),
          updatedBy: null,
        },
        where: { status: ArticleStatus.PUBLISHED },
        orderBy: ['createdAt_ASC'],
        first: 10,
        selection: `{
          status
          title
          score
          tags(orderBy: [order_ASC], first: 10) {
            order
            tag {
              title
            }
          }
        }`,
      },
    ],
    [
      'Article',
      myAdminContext,
      {
        data: {
          status: ArticleStatus.PUBLISHED,
          score: 1,
          tags: {
            create: {
              order: 0,
              tag: { connect: { slug: 'fashion' } },
            },
          },
          updatedAt: new Date('2022-06-01T00:00:00Z'),
        },
        where: { status: ArticleStatus.DRAFT },
        orderBy: ['createdAt_ASC'],
        first: 10,
        selection: `{
          status
          title
          score
          tags(orderBy: [order_ASC], first: 10) {
            order
            tag {
              title
            }
          }
        }`,
      },
    ],
    [
      'Article',
      myAdminContext,
      {
        data: {
          tags: {
            deleteIfExists: [
              { order: 1 },
              { tag: { slug: 'high-tech' } },
              { order: 2 },
              { tag: { slug: 'tv' } },
            ],
            // // Same result as above
            // deleteMany: {
            //   OR: [
            //     { order_in: [1, 2] },
            //     { tag: { slug_in: ['high-tech', 'tv'] } },
            //   ],
            // },
            create: [
              {
                order: 1,
                tag: { connect: { slug: 'high-tech' } },
              },
              {
                order: 2,
                tag: {
                  createIfNotExists: {
                    where: { slug: 'tv' },
                    data: { title: 'TV' },
                  },
                },
              },
            ],
          },
          updatedAt: new Date('2022-06-01T00:00:00Z'),
        },
        where: { status: ArticleStatus.PUBLISHED },
        orderBy: ['createdAt_ASC'],
        first: 10,
        selection: `{
          status
          title
          score
          tags(orderBy: [order_ASC], first: 10) {
            order
            tag {
              title
            }
          }
        }`,
      },
    ],
    [
      'Article',
      myAdminContext,
      {
        data: {
          tags: {
            deleteAll: true,
            create: R.range(0, 25).map((order) => ({
              order,
              tag: {
                createIfNotExists: {
                  where: { slug: `tag-${order}` },
                  data: { title: `Tag ${order}` },
                },
              },
            })),
          },
        },
        where: { status_not: ArticleStatus.DELETED },
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          title
          tags(orderBy: [order_ASC], first: 50) {
            order
            tag {
              title
            }
          }
        }`,
      },
    ],
    [
      'Article',
      myAdminContext,
      {
        data: {
          tags: {
            deleteAll: true,
            create: R.range(0, 25).map((order) => ({
              order,
              tag: {
                createIfNotExists: {
                  where: { slug: `tag-${order}` },
                  data: { title: `Tag ${order}` },
                },
              },
            })),
          },
        },
        where: { status_not: ArticleStatus.DELETED },
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          title
          tags(orderBy: [order_ASC], first: 50) {
            order
            tag {
              title
            }
          }
        }`,
      },
    ],
  ])('generates statements', async (nodeName, context, args) => {
    await expect(
      gp.api[nodeName].updateMany(context, args),
    ).resolves.toMatchSnapshot();
  });
});
