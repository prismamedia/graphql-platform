import { ChangedNode, Node } from '@prismamedia/graphql-platform';
import { MutationType } from '@prismamedia/graphql-platform-utils';
import {
  ArticleStatus,
  myAdminContext,
  MyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { MariaDBConnector } from '../../index.js';
import { makeGraphQLPlatform } from '../../__tests__/config.js';

describe('Update statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('update_statement');

    await gp.connector.setup();
    await gp.seed(fixtures, myAdminContext);
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it.each([
    [
      'Article',
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
        where: {
          status: ArticleStatus.PUBLISHED,
        },
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
      myAdminContext,
    ],
    [
      'Article',
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
        where: {
          status: ArticleStatus.DRAFT,
        },
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
      myAdminContext,
    ],
    [
      'Article',
      {
        data: {
          tags: {
            create: {
              order: 1,
              tag: { connect: { slug: 'high-tech' } },
            },
          },
          updatedAt: new Date('2022-06-01T00:00:00Z'),
        },
        where: {
          status: ArticleStatus.PUBLISHED,
        },
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
      myAdminContext,
    ],
  ])('generates statements', async (nodeName, args, context) => {
    const changes: ChangedNode[] = [];

    const subscriber = gp.changes.subscribe((change) => {
      changes.push(change);
    });

    try {
      await expect(
        gp
          .getNodeByName(nodeName)
          .getMutationByKey('update-many')
          .execute(args, context),
      ).resolves.toMatchSnapshot();
    } finally {
      subscriber.unsubscribe();
    }

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
    ).toMatchSnapshot();
  });
});
