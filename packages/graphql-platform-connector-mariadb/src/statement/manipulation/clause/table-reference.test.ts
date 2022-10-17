import { OperationContext } from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  MyGP,
  myJournalistContext,
  myUserContext,
  myVisitorContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { format } from '@sqltools/formatter';
import { MariaDBConnector } from '../../../index.js';
import { createGraphQLPlatform } from '../../../__tests__/config.js';
import { TableFactor } from './table-reference.js';

describe('Table reference', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = createGraphQLPlatform('connector_mariadb_table_reference_clause');

    await gp.connector.setup();
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it.each([
    myVisitorContext,
    myUserContext,
    myJournalistContext,
    myAdminContext,
  ])('generates valid SQL with authorization', (requestContext) => {
    const ArticleNode = gp.getNodeByName('Article');

    const ArticleCategoryEdge = ArticleNode.getEdgeByName('category');

    const ArticleCreatedByEdge = ArticleNode.getEdgeByName('createdBy');

    const UserNode = ArticleCreatedByEdge.head;
    const UserProfileReverseEdge =
      UserNode.getReverseEdgeUniqueByName('profile');

    const from = new TableFactor(
      gp.connector.schema.getTableByNode(ArticleNode),
      new OperationContext(gp, requestContext),
    );

    from.join(ArticleCategoryEdge);
    from.join(ArticleCreatedByEdge).join(UserProfileReverseEdge);

    expect(format(`SELECT * FROM ${from}`)).toMatchSnapshot();
  });

  it('generates valid SQL', () => {
    const ArticleNode = gp.getNodeByName('Article');
    const ArticleCategoryEdge = ArticleNode.getEdgeByName('category');
    const CategoryNode = ArticleCategoryEdge.head;
    const CategoryParentEdge = CategoryNode.getEdgeByName('parent');

    const from = new TableFactor(
      gp.connector.schema.getTableByNode(ArticleNode),
      new OperationContext(gp, myAdminContext),
    );

    from
      .join(ArticleCategoryEdge)
      .join(CategoryParentEdge)
      .join(CategoryParentEdge)
      .join(CategoryParentEdge);

    const ArticleCreatedByEdge = ArticleNode.getEdgeByName('createdBy');
    const UserNode = ArticleCreatedByEdge.head;
    const UserProfileReverseEdge =
      UserNode.getReverseEdgeUniqueByName('profile');

    from.join(ArticleCreatedByEdge).join(UserProfileReverseEdge);

    expect(format(`SELECT * FROM ${from}`)).toMatchInlineSnapshot(`
      "SELECT *
      FROM \`articles\`
        LEFT JOIN \`categories\` AS \`articles>categories\` ON \`articles\`.\`category_privateId\` <= > \`articles>categories\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>categories>categories\` ON \`articles>categories\`.\`parent_privateId\` <= > \`articles>categories>categories\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>categories>categories>categories\` ON \`articles>categories>categories\`.\`parent_privateId\` <= > \`articles>categories>categories>categories\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>categories>categories>categories>categories\` ON \`articles>categories>categories>categories\`.\`parent_privateId\` <= > \`articles>categories>categories>categories>categories\`.\`privateId\`
        LEFT JOIN \`users\` AS \`articles>users\` ON \`articles\`.\`created_by_id\` <= > \`articles>users\`.\`id\`
        LEFT JOIN \`user_profiles\` AS \`articles>users>user_profiles\` ON \`articles>users\`.\`id\` <= > \`articles>users>user_profiles\`.\`theUserId\`"
    `);
  });
});
