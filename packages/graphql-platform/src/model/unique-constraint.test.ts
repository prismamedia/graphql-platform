import { GraphQLPlatform } from '..';
import { Article, models } from '../__tests__/config';

describe('Unique constraint', () => {
  it('throws an Error on empty components', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              uniques: [...Article.uniques, []],
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article.2" unique constraint\'s definition - expects at least one "component" to be provided',
    );
  });

  it('throws an Error on unknown component', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            Article: {
              ...Article,
              uniques: [...Article.uniques, ['missingComponent']],
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "Article.missingComponent" unique constraint\'s definition - expects "component" among "_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas", got "missingComponent"',
    );
  });
});
