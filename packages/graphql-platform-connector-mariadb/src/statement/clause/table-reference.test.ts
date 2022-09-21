import { MyGP } from '@prismamedia/graphql-platform/__tests__/config.js';
import { MariaDBConnector } from '../../index.js';
import { makeGraphQLPlatform } from '../../__tests__/config.js';

describe('Table reference', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('table_reference_clause');

    await gp.connector.reset();
  });

  afterAll(async () => {
    try {
      await gp.connector.schema.drop({ ifExists: true });
    } finally {
      await gp.connector.pool.end();
    }
  });

  it('generates valid SQL', async () => {
    gp.connector.schema.getTableByNode(gp.getNodeByName('Article'));

    expect('').toEqual([
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
