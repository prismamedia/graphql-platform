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
        LEFT JOIN \`categories\` AS \`articles>category\` ON \`articles\`.\`category_privateId\` <= > \`articles>category\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>category>parent\` ON \`articles>category\`.\`parent_privateId\` <= > \`articles>category>parent\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>category>parent>parent\` ON \`articles>category>parent\`.\`parent_privateId\` <= > \`articles>category>parent>parent\`.\`privateId\`
        LEFT JOIN \`categories\` AS \`articles>category>parent>parent>parent\` ON \`articles>category>parent>parent\`.\`parent_privateId\` <= > \`articles>category>parent>parent>parent\`.\`privateId\`
        LEFT JOIN \`users\` AS \`articles>createdBy\` ON \`articles\`.\`created_by_id\` <= > \`articles>createdBy\`.\`id\`
        LEFT JOIN \`user_profiles\` AS \`articles>createdBy>profile\` ON \`articles>createdBy\`.\`id\` <= > \`articles>createdBy>profile\`.\`theUserId\`"
    `);
  });
});
