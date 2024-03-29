import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  myAdminContext,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
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
    await gp.seed(myAdminContext, fixtures.constant);
  });

  afterAll(() => gp.connector.teardown());

  it.each([
    ['Article', myUserContext, undefined],
    ['Article', myAdminContext, undefined],
    [
      'Article',
      myAdminContext,
      {
        where: {
          status: ArticleStatus.PUBLISHED,
          body_contains: 'my searched content',
          tagCount_gte: 5,
        },
      },
    ],
    [
      'Article',
      myAdminContext,
      {
        where: {
          status: ArticleStatus.PUBLISHED,
          category: { _id: 10 },
        },
      },
    ],
  ])('generates statements', async (nodeName, context, args) => {
    executedStatements.length = 0;

    await expect(
      gp.api[nodeName].count(context, args),
    ).resolves.toMatchSnapshot('result');

    expect(executedStatements).toMatchSnapshot('statements');
  });
});
