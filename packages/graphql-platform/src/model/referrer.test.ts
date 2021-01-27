import { GraphQLPlatform } from '..';
import { models } from '../__tests__/config';

describe('Referrer', () => {
  it("throws an Error on unknown reverse edge's head model", () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            User: {
              ...models.User,
              referrers: {
                ...models.User.referrers,
                invalidHead: { edge: 'UnknownModel' },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "User.invalidHead" reverse edge\'s definition - expects an "head" among "Article, Category, Tag, ArticleTag, User, UserProfile, Log", got "UnknownModel"',
    );
  });

  it("throws an Error on unknown reverse edge's head reference", () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            User: {
              ...models.User,
              referrers: {
                ...models.User.referrers,
                invalidHead: { edge: 'Article.myReferenceName' },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "User.invalidHead" reverse edge\'s definition - expects an "edge" among "category, createdBy, updatedBy", got "myReferenceName"',
    );
  });

  it('throws an Error on invalid reverse edge', () => {
    expect(
      () =>
        new GraphQLPlatform({
          models: {
            ...models,
            User: {
              ...models.User,
              referrers: {
                ...models.User.referrers,
                invalidHead: { edge: 'Article.category' },
              },
            },
          },
        }),
    ).toThrowError(
      'An error has been found in the "User.invalidHead" reverse edge\'s definition - expects an "edge" heading to this "User" model, got "Category"',
    );
  });
});
