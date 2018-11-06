import { NodeValue } from '@prismamedia/graphql-platform-core';
import { graphqlPlatform } from '../../../../../__tests__';

describe('Table', () => {
  const resourceMap = graphqlPlatform.getResourceMap();

  const database = graphqlPlatform.getConnector().getDatabase();

  it('gets/sets node/row value', () => {
    const articleTagCommentResource = resourceMap.assert('ArticleTagComment');
    const articleTagCommentTable = database.getTable(articleTagCommentResource);
    const articleTagCommentBodyColumn = articleTagCommentTable.getColumn(
      articleTagCommentResource.getFieldMap().assert('body'),
    );

    const articleResource = resourceMap.assert('Article');
    const articleTable = database.getTable(articleResource);
    const articleIntIdColumn = articleTable.getColumn(articleResource.getFieldMap().assert('_id'));

    const tagResource = resourceMap.assert('Tag');
    const tagTable = database.getTable(tagResource);
    const tagIntIdColumn = tagTable.getColumn(tagResource.getFieldMap().assert('_id'));

    const articleTagArticleIdColumnReference = articleTagCommentTable
      .getForeignKey(articleTagCommentResource.getRelationMap().assert('articleTag'))
      .getColumnSet()
      .find(column => column.getReferencedColumn() === articleIntIdColumn);

    const articleTagTagIdColumnReference = articleTagCommentTable
      .getForeignKey(articleTagCommentResource.getRelationMap().assert('articleTag'))
      .getColumnSet()
      .find(column => column.getReferencedColumn() === tagIntIdColumn);

    const node: NodeValue = {
      body: 'My body',
      articleTag: {
        article: {
          _id: 5,
        },
        tag: {
          _id: 15,
        },
      },
    };

    expect(articleTagCommentTable.getValue({}, articleTagCommentBodyColumn)).toBeUndefined();

    expect(articleTagCommentBodyColumn.getValue(node)).toEqual('My body');
    articleTagCommentBodyColumn.setValue(node, 'Another body');
    expect(articleTagCommentBodyColumn.getValue(node)).toEqual('Another body');

    if (articleTagArticleIdColumnReference) {
      expect(articleTagArticleIdColumnReference.getValue(node)).toEqual(5);
      articleTagArticleIdColumnReference.setValue(node, 50);
      expect(articleTagArticleIdColumnReference.getValue(node)).toEqual(50);
    }

    if (articleTagTagIdColumnReference) {
      expect(articleTagTagIdColumnReference.getValue(node)).toEqual(15);
      articleTagTagIdColumnReference.setValue(node, 150);
      expect(articleTagTagIdColumnReference.getValue(node)).toEqual(150);
    }

    expect(node).toEqual({
      body: 'Another body',
      articleTag: {
        article: {
          _id: 50,
        },
        tag: {
          _id: 150,
        },
      },
    });
  });
});
