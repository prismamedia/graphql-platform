import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { OperationContext } from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  myJournalistContext,
  myUserContext,
  myVisitorContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { format } from '@sqltools/formatter';
import { createMyGP, type MyGP } from '../../../__tests__/config.js';
import { TableFactor } from './table-reference.js';

describe('Table reference', () => {
  let gp: MyGP;

  beforeAll(async () => {
    gp = createMyGP('connector_mariadb_table_reference_clause');

    await gp.connector.setup();
  });

  afterAll(() => gp.connector.teardown());

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
      UserNode.getUniqueReverseEdgeByName('profile');

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
      UserNode.getUniqueReverseEdgeByName('profile');

    from.join(ArticleCreatedByEdge).join(UserProfileReverseEdge);

    expect(format(`SELECT * FROM ${from}`)).toMatchInlineSnapshot(`
      "SELECT *
      FROM \`articles\`
        LEFT JOIN \`categories\` AS \`articles>category\` ON \`articles\`.\`category_private_id\` <= > \`articles>category\`.\`private_id\`
        LEFT JOIN \`categories\` AS \`articles>category>parent\` ON \`articles>category\`.\`parent_private_id\` <= > \`articles>category>parent\`.\`private_id\`
        LEFT JOIN \`categories\` AS \`articles>category>parent>parent\` ON \`articles>category>parent\`.\`parent_private_id\` <= > \`articles>category>parent>parent\`.\`private_id\`
        LEFT JOIN \`categories\` AS \`articles>category>parent>parent>parent\` ON \`articles>category>parent>parent\`.\`parent_private_id\` <= > \`articles>category>parent>parent>parent\`.\`private_id\`
        LEFT JOIN \`users\` AS \`articles>createdBy\` ON \`articles\`.\`created_by_id\` <= > \`articles>createdBy\`.\`id\`
        LEFT JOIN \`user_profiles\` AS \`articles>createdBy>profile\` ON \`articles>createdBy\`.\`id\` = \`articles>createdBy>profile\`.\`theUserId\`"
    `);
  });
});
