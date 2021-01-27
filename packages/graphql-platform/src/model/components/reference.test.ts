import { print } from 'graphql';
import { GraphQLPlatform } from '../..';
import { Article, Category, models, MyGP } from '../../__tests__/config';

describe('Reference component', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it('throws an Error on missing "head"', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              components: {
                ...Article.components,
                edgeToAMissingModel: {
                  kind: 'Reference',
                  type: 'MissingModel',
                },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article.edgeToAMissingModel" component\'s definition - expects an "head" among "Article, Category, Tag, ArticleTag, User, UserProfile, Log", got "MissingModel"',
    );
  });

  it('throws an Error on missing "head reference"', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              components: {
                ...Article.components,
                edgeToAMissingReference: {
                  kind: 'Reference',
                  type: 'Article.missingUnique',
                },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article.edgeToAMissingReference" component\'s definition - expects an "head"\'s reference among "_id, id", got "missingUnique"',
    );
  });

  it('throws an Error on referencing itself', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            Category: {
              ...Category,
              components: {
                ...Category.components,
                parent: {
                  kind: 'Reference',
                  type: 'Category.parent-slug',
                },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Category.parent" component\'s definition - expects the "head" not to reference itself',
    );
  });

  it.each<[string, string, string]>([
    [
      'Article',
      'category',
      `category {
  parent {
    _id
  }
  slug
}`,
    ],
    [
      'Article',
      'createdBy',
      `createdBy {
  id
}`,
    ],
    [
      'Article',
      'updatedBy',
      `updatedBy {
  username
}`,
    ],
  ])('defines the "%s.%s" selection', (nodeName, edgeName, selectionSet) => {
    const edge = gp.getModel(nodeName).getReference(edgeName);

    expect(print(edge.selection.toFieldNode())).toEqual(selectionSet);
  });
});
