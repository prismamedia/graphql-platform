import type { CountQueryArgs, Node } from '@prismamedia/graphql-platform';
import {
  ArticleStatus,
  myAdminContext,
  myUserContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import { after, before, describe, it } from 'node:test';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Count statement', () => {
  let gp: MyGP;
  const executedStatements: string[] = [];

  before(async () => {
    gp = createMyGP(`connector_mariadb_count_statement`);
    gp.connector.on('executed-statement', ({ statement }) =>
      executedStatements.push(format(statement.sql).replaceAll('<= >', '<=>')),
    );

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  after(() => gp.connector.teardown());

  (
    [
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
    ] satisfies ReadonlyArray<[Node['name'], MyContext, CountQueryArgs]>
  ).forEach(([nodeName, context, args]) => {
    it('generates statements', async ({ assert: { snapshot } }) => {
      executedStatements.length = 0;

      snapshot(await gp.api[nodeName].count(context, args));

      snapshot(executedStatements);
    });
  });
});
