import {
  MyGP,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as rxjs from 'rxjs';
import { MariaDBConnector } from '../index.js';
import { makeGraphQLPlatform } from '../__tests__/config.js';
import { FindStatement } from './find.js';

describe('Find statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('find_statement');

    await gp.connector.setup();
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it('generates valid select statements', async () => {
    const statements: FindStatement['sql'][] = [];

    const subscriber = gp.connector.executedStatements
      .pipe(
        rxjs.filter(
          ({ statement }) =>
            statement instanceof FindStatement &&
            statement.table.name === 'articles',
        ),
      )
      .subscribe(({ statement }) => {
        statements.push(statement.sql);
      });

    try {
      await expect(
        gp.api.query.articles(
          {
            where: {},
            orderBy: ['createdAt_DESC'],
            first: 5,
            selection: `{ 
              title 
              category {
                title 
              }
              tags(first: 5) {
                tag {
                  title
                }
              }
            }`,
          },
          myUserContext,
        ),
      ).resolves.toEqual([]);
    } finally {
      subscriber.unsubscribe();
    }

    expect(statements).toEqual([
      `SELECT \`articles\`.*
FROM \`tests_find_statement\`.\`articles\` AS \`articles\``,
    ]);
  });
});
