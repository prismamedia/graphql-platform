import { ResourceMap } from '@prismamedia/graphql-platform-core';
import { GraphQLSelectionNode } from '@prismamedia/graphql-platform-utils';
import { config, MyGP } from '../../../../../__tests__/gp';
import { Connector } from '../../../../connector';
import { Database } from '../../../database';

describe('Find', () => {
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

  it('prefers foreign key columns over related node selection', () => {
    const Article = resourceMap.assert('Article');
    const ArticleCategory = Article.getRelationMap().assert('category');
    const articleTable = database.getTable(Article);
    const articleCategoryForeignKeyColumnSet = articleTable
      .getForeignKey(ArticleCategory)
      .getColumnSet();

    const findArticles = articleTable.getOperation('Find');

    const relatedNodeSelection = new GraphQLSelectionNode('category', {}, [
      new GraphQLSelectionNode('parent', {}, ['id', 'title']),
      'title',
      'slug',
    ]);

    expect(relatedNodeSelection.toPlainObject()).toEqual({
      parent: {
        name: 'parent',
        children: {
          id: {
            name: 'id',
          },
          title: {
            name: 'title',
          },
        },
      },
      title: {
        name: 'title',
      },
      slug: {
        name: 'slug',
      },
    });

    const selectedForeignKeyColumnSet =
      articleCategoryForeignKeyColumnSet.filter((column) =>
        findArticles.preferForeignKeyColumn(column, relatedNodeSelection),
      );

    expect([...selectedForeignKeyColumnSet].map(({ name }) => name)).toEqual([
      'categoryParentId',
      'categorySlug',
    ]);

    expect(relatedNodeSelection.toPlainObject()).toEqual({
      parent: {
        name: 'parent',
        children: {
          title: {
            name: 'title',
          },
        },
      },
      title: {
        name: 'title',
      },
    });
  });
});
