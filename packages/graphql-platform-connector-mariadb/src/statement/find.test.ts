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

    await gp.connector.reset();
  });

  afterAll(async () => {
    try {
      await gp.connector.schema.drop({ ifExists: true });
    } finally {
      await gp.connector.pool.end();
    }
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
FROM \`test_find\`.\`articles\` AS \`articles\`
  LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories\` ON \`articles\`.\`category_privateId\` = \`articles>categories\`.\`privateId\`
    LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories>categories\` ON \`articles>categories\`.\`parent_privateId\` = \`articles>categories>categories\`.\`privateId\`
      LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories>categories>categories\` ON \`articles>categories>categories\`.\`parent_privateId\` = \`articles>categories>categories>categories\`.\`privateId\`
  LEFT JOIN \`test_find\`.\`users\` AS \`articles>users\` ON \`articles\`.\`created_by_id\` = \`articles>users\`.\`id\`
  LEFT JOIN \`test_find\`.\`article_tags\` AS \`articles>article_tags\` ON \`articles\`.\`privateId\` = \`articles>article_tags\`.\`article_privateId\``,
    ]);
  });
});
