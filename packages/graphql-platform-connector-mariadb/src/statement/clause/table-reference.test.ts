import { MyGP } from '@prismamedia/graphql-platform/__tests__/config.js';
import { MariaDBConnector } from '../../index.js';
import { makeGraphQLPlatform } from '../../__tests__/config.js';
import { TableFactor } from './table-reference.js';

describe('Table reference', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('table_reference_clause');

    await gp.connector.setup();
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it('generates valid SQL', () => {
    const ArticleNode = gp.getNodeByName('Article');
    const ArticleCategoryEdge = ArticleNode.getEdgeByName('category');
    const CategoryNode = ArticleCategoryEdge.head;
    const CategoryParentEdge = CategoryNode.getEdgeByName('parent');

    const from = new TableFactor(
      gp.connector.schema.getTableByNode(ArticleNode),
    );

    from
      .join(ArticleCategoryEdge)
      .join(CategoryParentEdge)
      .join(CategoryParentEdge);

    const ArticleCreatedByEdge = ArticleNode.getEdgeByName('createdBy');
    const UserNode = ArticleCreatedByEdge.head;
    const UserProfileReverseEdge = UserNode.getReverseEdgeByName('profile');

    from.join(ArticleCreatedByEdge).join(UserProfileReverseEdge);

    const ArticleTagsReverseEdge = ArticleNode.getReverseEdgeByName('tags');

    from.join(ArticleTagsReverseEdge);

    expect(`FROM ${from}`).toMatchInlineSnapshot(`
      "FROM \`tests_table_reference_clause\`.\`articles\` AS \`articles\`
        LEFT JOIN \`tests_table_reference_clause\`.\`categories\` AS \`articles>categories\` ON \`articles\`.\`category_privateId\` = \`articles>categories\`.\`privateId\`
          LEFT JOIN \`tests_table_reference_clause\`.\`categories\` AS \`articles>categories>categories\` ON \`articles>categories\`.\`parent_privateId\` = \`articles>categories>categories\`.\`privateId\`
            LEFT JOIN \`tests_table_reference_clause\`.\`categories\` AS \`articles>categories>categories>categories\` ON \`articles>categories>categories\`.\`parent_privateId\` = \`articles>categories>categories>categories\`.\`privateId\`
        LEFT JOIN \`tests_table_reference_clause\`.\`users\` AS \`articles>users\` ON \`articles\`.\`created_by_id\` = \`articles>users\`.\`id\`
          LEFT JOIN \`tests_table_reference_clause\`.\`user_profiles\` AS \`articles>users>user_profiles\` ON \`articles>users\`.\`id\` = \`articles>users>user_profiles\`.\`theUserId\`
        LEFT JOIN \`tests_table_reference_clause\`.\`article_tags\` AS \`articles>article_tags\` ON \`articles\`.\`privateId\` = \`articles>article_tags\`.\`article_privateId\`"
    `);
  });
});
