import { GraphQLString } from 'graphql';
import { AbstractField, assertInputObject, InputField } from './object-field';

class Implementation extends AbstractField {}

describe('Object field', () => {
  const publicParent = Object.freeze({ name: 'parent', public: true });
  const privateParent = Object.freeze({ name: 'parent', public: false });

  const inputFields = [
    new InputField(publicParent, 'default', { type: GraphQLString }),
    new InputField(publicParent, 'nonNull', {
      type: GraphQLString,
      nullable: false,
    }),
    new InputField(publicParent, 'nonNullWithDefault', {
      type: GraphQLString,
      nullable: false,
      defaultValue: 'myDefaultValue',
    }),
    new InputField(publicParent, 'nonNullNonRequired', {
      type: GraphQLString,
      nullable: false,
      required: false,
    }),
    new InputField(publicParent, 'nullableRequired', {
      type: GraphQLString,
      required: true,
    }),
    new InputField(publicParent, 'nullableRequiredWithDefault', {
      type: GraphQLString,
      required: true,
      defaultValue: null,
    }),
  ];

  it.each([
    [undefined, true],
    [{}, true],
    [{ public: true }, true],
    [{ public: () => true }, true],
    [{ public: false }, false],
    [{ public: () => false }, false],
  ])(`a public object's field accepts the config: %p`, (config, visibility) => {
    expect(new Implementation(publicParent, 'field', config).public).toEqual(
      visibility,
    );
  });

  it.each([
    [undefined, false],
    [{}, false],
    [{ public: false }, false],
    [{ public: () => false }, false],
  ])(
    `a private object's field accepts the config: %p`,
    (config, visibility) => {
      expect(new Implementation(privateParent, 'field', config).public).toEqual(
        visibility,
      );
    },
  );

  it.each([{ public: true }, { public: () => true }])(
    `a private object's field cannot use the config: %p`,
    (config) => {
      expect(
        () => new Implementation(privateParent, 'field', config).public,
      ).toThrowError();
    },
  );

  it.each([
    [
      undefined,
      `An error occurred at \"nonNull\" - expects a "String", got: undefined`,
    ],
    [
      null,
      `An error occurred at \"nonNull\" - expects a "String", got: undefined`,
    ],
    [
      {},
      `An error occurred at \"nonNull\" - expects a "String", got: undefined`,
    ],
    [
      { nonNull: null },
      `An error occurred at \"nonNull\" - expects a non-null "String", got: null`,
    ],
    [
      { nonNull: 123 },
      'An error occurred at "nonNull" - expects a "String", got: 123',
    ],
    [
      { nonNull: '123' },
      'An error occurred at "nullableRequired" - expects a "String", got: undefined',
    ],
  ])('throws an error on assertInputObject(%p)', (value, error) => {
    expect(() => assertInputObject(value, inputFields)).toThrowError(error);
  });

  it.each([
    [
      { nonNull: 'A non-null value', nullableRequired: null },
      {
        nonNull: 'A non-null value',
        nonNullWithDefault: 'myDefaultValue',
        nullableRequired: null,
        nullableRequiredWithDefault: null,
      },
    ],
    [
      {
        nonNull: 'A non-null value',
        nonNullWithDefault: 'A non-null value',
        nullableRequired: 'A non-null value',
        nullableRequiredWithDefault: 'A non-null value',
      },
      {
        nonNull: 'A non-null value',
        nonNullWithDefault: 'A non-null value',
        nullableRequired: 'A non-null value',
        nullableRequiredWithDefault: 'A non-null value',
      },
    ],
  ])('assertInputObject(%p) = %p', (value, expected) => {
    expect(assertInputObject(value, inputFields)).toEqual(expected);
  });

  it('an input field is required when is required and has no default value', () => {
    expect(inputFields.filter((field) => field.required).map(String)).toEqual([
      'parent.nonNull',
      'parent.nullableRequired',
    ]);
  });
});
