import { ResourceMap } from '@prismamedia/graphql-platform-core';
import { config, MyGP } from '../../../../../__tests__/gp';
import { Connector } from '../../../../connector';
import { Database } from '../../../database';

describe('Table', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;
  let resourceMap: ResourceMap;

  beforeAll(() => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();
    resourceMap = gp.getResourceMap();
  });

  it("gets columns' value", () => {
    const articleTagCommentResource = resourceMap.assert('ArticleTagComment');
    const articleTagCommentTable = database.getTable(articleTagCommentResource);
    const articleTagCommentBodyColumn = articleTagCommentTable.getColumn(
      articleTagCommentResource.getFieldMap().assert('body'),
    );

    const articleResource = resourceMap.assert('Article');
    const articleTable = database.getTable(articleResource);
    const articleIntIdColumn = articleTable.getColumn(
      articleResource.getFieldMap().assert('_id'),
    );

    const tagResource = resourceMap.assert('Tag');
    const tagTable = database.getTable(tagResource);
    const tagIntIdColumn = tagTable.getColumn(
      tagResource.getFieldMap().assert('_id'),
    );

    const articleTagArticleIdColumnReference = articleTagCommentTable
      .getForeignKey(
        articleTagCommentResource.getRelationMap().assert('articleTag'),
      )
      .getColumnSet()
      .find(
        (column) => column.getReferencedColumn() === articleIntIdColumn,
        true,
      );

    const articleTagTagIdColumnReference = articleTagCommentTable
      .getForeignKey(
        articleTagCommentResource.getRelationMap().assert('articleTag'),
      )
      .getColumnSet()
      .find((column) => column.getReferencedColumn() === tagIntIdColumn, true);

    const node = articleTagCommentResource.assertValue({
      body: 'My body',
      articleTag: {
        article: {
          _id: 5,
        },
        tag: {
          _id: 15,
        },
      },
      updatedAt: new Date('2019-01-01T00:00:00.000Z'),
      createdAt: new Date('2019-01-01T00:00:00.000Z'),
    });

    expect(articleTagCommentBodyColumn.pickValue(node)).toEqual('My body');
    // articleTagCommentBodyColumn.setValue(node, 'Another body');
    // expect(articleTagCommentBodyColumn.getValue(node, true)).toEqual('Another body');

    expect(articleTagArticleIdColumnReference.pickValue(node)).toEqual(5);
    // articleTagArticleIdColumnReference.setValue(node, 50);
    // expect(articleTagArticleIdColumnReference.getValue(node, true)).toEqual(50);

    expect(articleTagTagIdColumnReference.pickValue(node)).toEqual(15);
    // articleTagTagIdColumnReference.setValue(node, 150);
    // expect(articleTagTagIdColumnReference.getValue(node, true)).toEqual(150);

    // expect(node).toEqual({
    //   body: 'Another body',
    //   articleTag: {
    //     article: {
    //       _id: 50,
    //     },
    //     tag: {
    //       _id: 150,
    //     },
    //   },
    // });
  });
});
