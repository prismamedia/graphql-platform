import { GraphQLInt, GraphQLNonNull, GraphQLString } from 'graphql';
import { InputField } from './field';

describe('Input field', () => {
  it.each<
    [
      field: InputField,
      required: boolean,
      success?: [input: any, result?: any][],
      errors?: [input: any, error: any][],
    ]
  >([
    [
      new InputField({ name: 'integer', type: GraphQLInt }),
      false,
      [[undefined], [null], [10]],
      [
        [{}, 'Expects an "Int", got: {}'],
        [true, 'Expects an "Int", got: true'],
        ['0', 'Expects an "Int", got: "0"'],
      ],
    ],
    [
      new InputField({ name: 'string', type: GraphQLString }),
      false,
      [[undefined], [null], ['my string']],
      [
        [{}, 'Expects a "String", got: {}'],
        [true, 'Expects a "String", got: true'],
        [0, 'Expects a "String", got: 0'],
      ],
    ],
    [
      new InputField({
        name: 'GraphQLNonNullString',
        type: new GraphQLNonNull(GraphQLString),
      }),
      true,
      undefined,
      [
        [undefined, 'Expects the "String!" not to be nullish, got: undefined'],
        [null, 'Expects the "String!" not to be nullish, got: null'],
      ],
    ],
    [
      new InputField({
        name: 'GraphQLNonNullStringWithDefaultValue',
        type: new GraphQLNonNull(GraphQLString),
        defaultValue: 'My default value',
      }),
      false,
      [[undefined, 'My default value']],
      [[null, 'Expects the "String!" not to be nullish, got: null']],
    ],
    [
      new InputField({
        name: 'nonOptionalNonNullableString',
        type: GraphQLString,
        optional: false,
        nullable: false,
      }),
      true,
    ],
    [
      new InputField({
        name: 'nonNullableString',
        type: GraphQLString,
        nullable: false,
      }),
      false,
      [[undefined], ['my string']],
      [[null, 'Expects the non-nullable "String" not to be null, got: null']],
    ],
    [
      new InputField({
        name: 'nonOptionalString',
        type: GraphQLString,
        optional: false,
      }),
      true,
      [[null], ['my string']],
      [
        [
          undefined,
          'Expects the non-optional "String" not to be undefined, got: undefined',
        ],
      ],
    ],
  ])('"%s" works', (field, required, success = [], errors = []) => {
    expect(field.required).toBe(required);

    if (!field.public) {
      expect(field.graphql).toBeDefined();
    }

    success.forEach(([value, result = value]) =>
      expect(field.assertValue(value)).toEqual(result),
    );

    errors.forEach(([value, error]) =>
      expect(() => field.assertValue(value)).toThrow(error),
    );

    expect(field.graphql).toMatchSnapshot(field.name);
  });

  it('throws an error on invalid "defaultValue"', () => {
    expect(
      () =>
        new InputField({
          name: 'GraphQLNonNullStringWithInvalidDefaultValue',
          type: new GraphQLNonNull(GraphQLString),
          defaultValue: null,
        }),
    ).toThrowError(
      'An error occurred at "GraphQLNonNullStringWithInvalidDefaultValue.defaultValue" - expects the "String!" not to be nullish, got: null',
    );
  });

  // it.skip('a "non-nullable" input field\'s type cannot be wrapped with "GraphQLNonNull"', () => {
  //   expect(
  //     () =>
  //       new InputField({
  //         name: 'willFail',
  //         type: new GraphQLNonNull(GraphQLString),
  //         nullable: true,
  //       }),
  //   ).toThrow(
  //     '"willFail"\'s cannot be "nullable" as its type "String!" is a not',
  //   );
  // });

  // it.skip.each([undefined, null, {}, { myStringField: undefined }])(
  //   'object without required fields accepts "%p"',
  //   (input) => {
  //     expect(
  //       assertInputObject(input, [
  //         new InputField({ name: 'myStringField', type: GraphQLString }),
  //       ]),
  //     ).toBeUndefined();
  //   },
  // );

  // it.skip('object does not accept extra keys', () => {
  //   expect(() => assertInputObject({ test: undefined }, [])).toThrow(
  //     'Expects not to contain the extra key(s) "test"',
  //   );
  // });
});
