import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { Node, NodeChange } from '@prismamedia/graphql-platform';
import { MutationType } from '@prismamedia/graphql-platform-utils';
import {
  ArticleStatus,
  myAdminContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import * as R from 'remeda';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Update statement', () => {
  let gp: MyGP;
  const changes: NodeChange[] = [];

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_update_statement`);
    gp.on('node-change-aggregation', (aggregation) =>
      changes.push(...aggregation),
    );

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  beforeEach(() => {
    changes.length = 0;
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
            create: R.range(0, 10).map((order) => ({
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
        first: 10,
        selection: `{
          status
          title
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
            create: R.range(0, 10).map((order) => ({
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
        first: 10,
        selection: `{
          status
          title
        }`,
      },
    ],
  ])('generates statements', async (nodeName, context, args) => {
    await expect(
      gp.api[nodeName].updateMany(context, args),
    ).resolves.toMatchSnapshot('result');

    expect(
      changes.reduce<Map<Node['name'], Map<MutationType, number>>>(
        (changesByMutationTypeByNodeName, change) => {
          let changesByMutationType = changesByMutationTypeByNodeName.get(
            change.node.name,
          );

          if (!changesByMutationType) {
            changesByMutationTypeByNodeName.set(
              change.node.name,
              (changesByMutationType = new Map()),
            );
          }

          changesByMutationType.set(
            change.kind,
            (changesByMutationType.get(change.kind) ?? 0) + 1,
          );

          return changesByMutationTypeByNodeName;
        },
        new Map(),
      ),
    ).toMatchSnapshot('changes');
  });
});
