import {
  GraphQLNonNull,
  GraphQLString,
  printSchema,
  validateSchema,
} from 'graphql';
import { Edge, GraphQLPlatform, Leaf } from '.';
import { nodes } from './__tests__/config';

describe('GraphQL Platform', () => {
  it('throws an Error on empty nodes', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {},
        }),
    ).toThrowError('GraphQL Platform expects at least one node to be defined');
  });

  it('throws an Error on unknown node', () => {
    const gp = new GraphQLPlatform({ nodes });

    expect(() => gp.getNode('UnknownResource')).toThrowError(
      'The "UnknownResource" node does not exist, did you mean:',
    );

    expect(() => gp.getNode('article')).toThrowError(
      'The "article" node does not exist, did you mean: Article',
    );
  });

  it('throws an Error on unknown component', () => {
    const gp = new GraphQLPlatform({ nodes });

    expect(() =>
      gp.getNode('Article').getComponent('UnknownComponent'),
    ).toThrowError(
      'The "Article" node does not contain the component "UnknownComponent", did you mean:',
    );

    expect(() => gp.getNode('Article').getComponent('ID')).toThrowError(
      'The "Article" node does not contain the component "ID", did you mean:',
    );
  });

  it('throws an Error on non-unique reverse edge name', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            ...nodes,
            User: { ...nodes.User, reverseEdges: {} },
          },
        }),
    ).toThrowError(
      'The "User" node has more than one reverse edge named "articles", you have to configure their name through the "reverseEdges" parameter: Article.createdBy, Article.updatedBy',
    );
  });

  it('throws an Error on missing reverse edge', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            ...nodes,
            User: {
              ...nodes.User,
              reverseEdges: {
                ...nodes.User.reverseEdges,
                'Article.unknownReference': { name: 'myReferrerName' },
              },
            },
          },
        }),
    ).toThrowError(
      'The "User" node has unknown reverse edge definition: Article.unknownReference',
    );
  });

  it('throws an Error on custom field with invalid name', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            ...nodes,
            User: {
              ...nodes.User,
              customFields: {
                username: {
                  args: {},
                  type: GraphQLNonNull(GraphQLString),
                  resolve: () => 'MyUsername',
                },
              },
            },
          },
        }),
    ).toThrowError(
      '"User" contains at least 2 filters with the same name "username"',
    );
  });

  it('has valid nodes', () => {
    const gp = new GraphQLPlatform({ nodes });

    expect([...gp.nodeMap.keys()]).toEqual([
      'Article',
      'Category',
      'Tag',
      'ArticleTag',
      'User',
      'UserProfile',
      'Log',
      'Hit',
    ]);

    // Article
    {
      const Article = gp.getNode('Article');

      expect(Article.name).toEqual('Article');

      expect([...Article.componentMap.keys()]).toEqual([
        '_id',
        'id',
        'status',
        'title',
        'slug',
        'body',
        'category',
        'createdBy',
        'createdAt',
        'updatedBy',
        'updatedAt',
        'metas',
      ]);

      const body = Article.getComponent('body');
      expect(body).toBeInstanceOf(Leaf);

      const category = Article.getComponent('category');
      expect(category).toBeInstanceOf(Edge);

      const createdBy = Article.getEdge('createdBy');
      expect(createdBy).toBeInstanceOf(Edge);
      expect(createdBy.reference.name).toEqual('id');

      const updatedBy = Article.getEdge('updatedBy');
      expect(updatedBy).toBeInstanceOf(Edge);
      expect(updatedBy.reference.name).toEqual('username');

      expect([...Article.uniqueConstraintMap.keys()]).toEqual(['_id', 'id']);
    }

    // Category
    {
      const Category = gp.getNode('Category');

      expect(Category.name).toEqual('Category');

      expect([...Category.componentMap.keys()]).toEqual([
        '_id',
        'id',
        'title',
        'slug',
        'parent',
        'order',
      ]);

      const parent = Category.getEdge('parent');
      expect(parent).toBeInstanceOf(Edge);
      expect(parent.reference.name).toEqual('_id');

      expect([...Category.uniqueConstraintMap.keys()]).toEqual([
        '_id',
        'id',
        'parent-slug',
        'parent-order',
      ]);
    }
  });

  it('generates a valid GraphQL Schema', () => {
    const { schema } = new GraphQLPlatform({ nodes: nodes });

    expect(validateSchema(schema)).toEqual([]);

    expect(
      printSchema(schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });
});
