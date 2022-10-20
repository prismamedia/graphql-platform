import {
  ArticleStatus,
  myAdminContext,
  MyGP,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import { MariaDBConnector } from '../../index.js';
import { createGraphQLPlatform } from '../../__tests__/config.js';

describe('Find statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = createGraphQLPlatform('connector_mariadb_find_statement');

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
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
          body
          views
          score
          machineTags
          metas
          tagCount
          createdAt
        }`,
      },
      myUserContext,
    ],
    [
      'Article',
      {
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
          body
          views
          score
          machineTags
          metas
          tagCount
          createdAt
        }`,
      },
      myAdminContext,
    ],
    [
      'Article',
      {
        where: {
          OR: [
            { body_is_null: true },
            { body_contains: 'my +searched -text here' },
          ],
          status: ArticleStatus.PUBLISHED,
          category: { slug: 'tv' },
          createdAt_gte: '2022-01-01T00:00:00Z',
          createdBy: {
            profile: {
              OR: [
                { facebookId_is_null: false },
                { googleId_is_null: false },
                { twitterHandle_is_null: false },
              ],
            },
          },
          tagCount_gt: 5,
          tags_some: { tag: { deprecated_not: true } },
        },
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
          category {
            title
          }
          createdBy {
            username
            profile {
              facebookId
              googleId
              twitterHandle
            }
          }
          allTagCount: tagCount
          filteredTagCount: tagCount(where: { tag_not: { deprecated: true }})
          allTags: tags(orderBy: [order_ASC], first: 5) {
            order
            tag {
              title
              deprecated
            }
          }
          filteredTags: tags(where: { tag_not: { deprecated: true }}, orderBy: [order_ASC], first: 5) {
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
    const statements: string[] = [];

    const subscriber = gp.connector.executedStatements.subscribe(
      ({ statement }) => {
        statements.push(format(statement.sql).replaceAll('<= >', '<=>'));
      },
    );

    try {
      await expect(
        gp
          .getNodeByName(nodeName)
          .getQueryByKey('find-many')
          .execute(args, context),
      ).resolves.toMatchSnapshot();
    } finally {
      subscriber.unsubscribe();
    }

    expect(statements).toMatchSnapshot();
  });
});
