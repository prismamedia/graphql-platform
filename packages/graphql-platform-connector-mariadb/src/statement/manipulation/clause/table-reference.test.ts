import { OperationContext } from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  myJournalistContext,
  myUserContext,
  myVisitorContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { format } from '@sqltools/formatter';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { after, before, describe, it } from 'node:test';
import { createMyGP } from '../../../__tests__/config.js';
import { TableFactor } from './table-reference.js';

describe('Table reference', () => {
  const gp = createMyGP('connector_mariadb_table_reference_clause');

  before(() => gp.connector.setup());
  after(() => gp.connector.teardown());

  (
    [
      myVisitorContext,
      myUserContext,
      myJournalistContext,
      myAdminContext,
    ] satisfies ReadonlyArray<MyContext>
  ).forEach((requestContext) => {
    it(`generates valid SQL with authorization`, ({ assert: { snapshot } }) => {
      const ArticleNode = gp.getNodeByName('Article');

      const ArticleCategoryEdge = ArticleNode.getEdgeByName('category');

      const ArticleCreatedByEdge = ArticleNode.getEdgeByName('createdBy');

      const UserNode = ArticleCreatedByEdge.head;
      const UserProfileReverseEdge =
        UserNode.getUniqueReverseEdgeByName('profile');

      const from = new TableFactor(
        gp.connector.schema.getTableByNode(ArticleNode),
        { context: new OperationContext(gp, requestContext) },
      );

      from.join(ArticleCategoryEdge);
      from.join(ArticleCreatedByEdge).join(UserProfileReverseEdge);

      snapshot(
        format(
          [
            from.authorizedTables.size &&
              `WITH ${Array.from(from.authorizedTables, String).join()}`,
            `SELECT * FROM ${from}`,
          ]
            .filter(Boolean)
            .join(' '),
        ).split(EOL),
      );
    });
  });

  it('generates valid SQL', () => {
    const ArticleNode = gp.getNodeByName('Article');
    const ArticleCategoryEdge = ArticleNode.getEdgeByName('category');
    const CategoryNode = ArticleCategoryEdge.head;
    const CategoryParentEdge = CategoryNode.getEdgeByName('parent');

    const from = new TableFactor(
      gp.connector.schema.getTableByNode(ArticleNode),
      { context: new OperationContext(gp, myAdminContext) },
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

    assert.strictEqual(from.authorizedTables.size, 0);
    assert.strictEqual(
      format(`SELECT * FROM ${from}`),
      `SELECT *
FROM \`articles\`
  LEFT JOIN \`categories\` AS \`articles>category\` ON \`articles\`.\`category_private_id\` = \`articles>category\`.\`private_id\`
  LEFT JOIN \`categories\` AS \`articles>category>parent\` ON \`articles>category\`.\`parent_private_id\` = \`articles>category>parent\`.\`private_id\`
  LEFT JOIN \`categories\` AS \`articles>category>parent>parent\` ON \`articles>category>parent\`.\`parent_private_id\` = \`articles>category>parent>parent\`.\`private_id\`
  LEFT JOIN \`categories\` AS \`articles>category>parent>parent>parent\` ON \`articles>category>parent>parent\`.\`parent_private_id\` = \`articles>category>parent>parent>parent\`.\`private_id\`
  LEFT JOIN \`users\` AS \`articles>createdBy\` ON \`articles\`.\`created_by_id\` = \`articles>createdBy\`.\`id\`
  LEFT JOIN \`user_profiles\` AS \`articles>createdBy>profile\` ON \`articles>createdBy>profile\`.\`theUserId\` = \`articles>createdBy\`.\`id\``,
    );
  });
});
