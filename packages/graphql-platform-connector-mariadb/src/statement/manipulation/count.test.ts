import {
  ArticleStatus,
  myAdminContext,
  MyGP,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import { MariaDBConnector } from '../../index.js';
import { makeGraphQLPlatform } from '../../__tests__/config.js';

describe('Count statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('count_statement');

    await gp.connector.setup();
    await gp.seed(fixtures, myAdminContext);
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it.each([
    ['Article', undefined, myUserContext],
    ['Article', undefined, myAdminContext],
    [
      'Article',
      {
        where: {
          status: ArticleStatus.PUBLISHED,
          body_contains: 'my searched content',
          tagCount_gte: 5,
        },
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
          .getQueryByKey('count')
          .execute(args, context),
      ).resolves.toMatchSnapshot();
    } finally {
      subscriber.unsubscribe();
    }

    expect(statements).toMatchSnapshot();
  });
});
