import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  myAdminContext,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Count statement', () => {
  let gp: MyGP;
  const executedStatements: string[] = [];

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_count_statement`);
    gp.connector.on('executed-statement', ({ statement }) =>
      executedStatements.push(format(statement.sql).replaceAll('<= >', '<=>')),
    );

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
    executedStatements.length = 0;

    await expect(
      gp.getNodeByName(nodeName).getQueryByKey('count').execute(args, context),
    ).resolves.toMatchSnapshot('result');

    expect(executedStatements).toMatchSnapshot('statements');
  });
});
