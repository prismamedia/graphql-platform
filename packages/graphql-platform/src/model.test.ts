import { GraphQLPlatform } from '.';
import { Model } from './model';

describe('Model', () => {
  it('throws an Error on invalid name against GraphQL rules', () => {
    expect(
      () =>
        new Model(
          {} as GraphQLPlatform,
          '-InvalidName',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      'An error has been found in the "-InvalidName" model\'s definition - expects a "name" valid against the GraphQL rules',
    );
  });

  it('throws an Error if its name is not in PascalCase', () => {
    expect(
      () =>
        new Model(
          {} as GraphQLPlatform,
          'invalidName',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      'An error has been found in the "invalidName" model\'s definition - expects a name in "PascalCase" (= "InvalidName")',
    );
  });

  it('throws an Error if its singular and plural forms are equal', () => {
    expect(
      () =>
        new Model(
          {} as GraphQLPlatform,
          'Data',
          // @ts-expect-error
          {},
        ),
    ).toThrowError(
      'An error has been found in the "Data" model\'s definition - expects a difference between the "name" and the "plural" form, you have to define the "plural" parameter as we were not able to guess a valid one',
    );
  });

  it('throws an Error if its "public" value is invalid', () => {
    expect(
      () =>
        new Model(
          { public: false } as GraphQLPlatform,
          'Article',
          // @ts-expect-error
          { public: 'false' },
        ),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects a valid "public" value',
    );
  });

  it('throws an Error if it is public in a private API', () => {
    expect(
      () =>
        new Model(
          { public: false } as GraphQLPlatform,
          'Article',
          // @ts-expect-error
          { public: true },
        ),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects not to be public as the GraphQL Platform is not',
    );
  });

  it('throws an Error on empty components', () => {
    expect(
      () =>
        new Model(
          {} as GraphQLPlatform,
          'Article',
          // @ts-expect-error
          {
            components: {},
          },
        ),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects at least one "component" to be defined',
    );
  });

  it('throws an Error on empty unique constraints', () => {
    expect(
      () =>
        new Model({} as GraphQLPlatform, 'Article', {
          components: { id: { kind: 'Leaf', type: 'ID' } },
          uniques: [],
        }),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects at least one "unique constraint" to be defined',
    );
  });

  it('throws an Error on nullable identifier', () => {
    expect(
      () =>
        new Model({} as GraphQLPlatform, 'Article', {
          components: { id: { kind: 'Leaf', type: 'ID' } },
          uniques: [['id']],
        }),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects its identifier (= the first "unique constraint") to be non-nullable (= at least one of its components being non-nullable)',
    );
  });

  it('throws an Error on mutable identifier', () => {
    expect(
      () =>
        new Model({} as GraphQLPlatform, 'Article', {
          components: { id: { kind: 'Leaf', type: 'ID', nullable: false } },
          uniques: [['id']],
        }),
    ).toThrowError(
      'An error has been found in the "Article" model\'s definition - expects its identifier (= the first "unique constraint") to be immutable (= all its components being immutable)',
    );
  });
});
