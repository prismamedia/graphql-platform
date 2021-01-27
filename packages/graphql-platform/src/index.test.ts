import { printSchema, validateSchema } from 'graphql';
import { GraphQLPlatform, Leaf, Reference } from '.';
import { models } from './__tests__/config';

describe('GraphQL Platform', () => {
  it('throws an Error on invalid visibility', () => {
    expect(
      () =>
        new GraphQLPlatform({
          // @ts-expect-error
          public: 'invalid',
        }),
    ).toThrowError(
      'An error has been found in the GraphQL Platform\'s definition - expects a valid "public" value',
    );
  });

  it('throws an Error on empty models', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {},
        }),
    ).toThrowError(
      'An error has been found in the GraphQL Platform\'s definition - expects at least one "model" to be defined',
    );
  });

  it('throws an Error on unknown model', () => {
    const gp = new GraphQLPlatform({ models });

    expect(() => gp.getModel('UnknownResource')).toThrowError(
      'The "UnknownResource" model does not exist, did you mean:',
    );

    expect(() => gp.getModel('article')).toThrowError(
      'The "article" model does not exist, did you mean: Article',
    );
  });

  it("throws an Error on unknown model's component", () => {
    const gp = new GraphQLPlatform({ models });

    expect(() =>
      gp.getModel('Article').getComponent('UnknownComponent'),
    ).toThrowError(
      'The "Article" model does not contain the component "UnknownComponent", did you mean:',
    );

    expect(() => gp.getModel('Article').getComponent('ID')).toThrowError(
      'The "Article" model does not contain the component "ID", did you mean:',
    );
  });

  it('has valid models', () => {
    const gp = new GraphQLPlatform({ models });

    expect([...gp.modelMap.keys()]).toEqual([
      'Article',
      'Category',
      'Tag',
      'ArticleTag',
      'User',
      'UserProfile',
      'Log',
    ]);

    // Article
    {
      const Article = gp.getModel('Article');

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
      expect(category).toBeInstanceOf(Reference);

      const createdBy = Article.getReference('createdBy');
      expect(createdBy).toBeInstanceOf(Reference);
      expect(createdBy.referencedUniqueConstraint.name).toEqual('id');

      const updatedBy = Article.getReference('updatedBy');
      expect(updatedBy).toBeInstanceOf(Reference);
      expect(updatedBy.referencedUniqueConstraint.name).toEqual('username');

      expect([...Article.uniqueConstraintMap.keys()]).toEqual(['_id', 'id']);
    }

    // Category
    {
      const Category = gp.getModel('Category');

      expect(Category.name).toEqual('Category');

      expect([...Category.componentMap.keys()]).toEqual([
        '_id',
        'id',
        'title',
        'slug',
        'parent',
        'order',
      ]);

      const parent = Category.getReference('parent');
      expect(parent).toBeInstanceOf(Reference);
      expect(parent.referencedUniqueConstraint.name).toEqual('_id');

      expect([...Category.uniqueConstraintMap.keys()]).toEqual([
        '_id',
        'id',
        'parent-slug',
        'parent-order',
      ]);
    }
  });

  it('generates a valid GraphQL Schema', () => {
    const { schema } = new GraphQLPlatform({ models });

    expect(validateSchema(schema)).toEqual([]);

    expect(
      printSchema(schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });
});
