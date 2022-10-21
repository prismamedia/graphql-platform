import * as graphql from 'graphql';
import {
  Input,
  InputConfig,
  ListableInputType,
  nonNillableInputType,
  NonNullableInputType,
  NonOptionalInputType,
  ObjectInputType,
} from './input.js';
import { Nillable } from './nil.js';
import { addPath } from './path.js';

describe('Input', () => {
  const testPath = addPath(undefined, 'test');

  it.each<[config: InputConfig, error: string]>([
    [
      {
        name: 'InputWithInvalidStaticDefaultValue',
        type: graphql.GraphQLInt,
        defaultValue: 'a string',
      },
      `"InputWithInvalidStaticDefaultValue.defaultValue" - Expects to be valid against the type "Int" and the custom validation, got: 'a string'
└ Cause: "InputWithInvalidStaticDefaultValue" - Expects an "Int", got: 'a string'
  └ Cause: Int cannot represent non-integer value: "a string"`,
    ],
    [
      {
        name: 'InputWithInvalidThunkedDefaultValue',
        type: graphql.GraphQLInt,
        defaultValue: () => 'a string',
      },
      `"InputWithInvalidThunkedDefaultValue.defaultValue" - Expects to be valid against the type "Int" and the custom validation, got: 'a string'
└ Cause: "InputWithInvalidThunkedDefaultValue" - Expects an "Int", got: 'a string'
  └ Cause: Int cannot represent non-integer value: "a string"`,
    ],
    [
      {
        name: 'InputWithCustomValidationAndInvalidThunkedDefaultValue',
        type: graphql.GraphQLInt,
        assertValue: (value) => {
          if (value < 18) {
            throw new Error('Must be greater than 18');
          }
        },
        defaultValue: () => 16,
      },
      `"InputWithCustomValidationAndInvalidThunkedDefaultValue.defaultValue" - Expects to be valid against the type "Int" and the custom validation, got: 16
└ Cause: "InputWithCustomValidationAndInvalidThunkedDefaultValue" - Must be greater than 18`,
    ],
  ])('cannot have an invalid defaultValue', (config, error) => {
    expect(() => new Input(config)).toThrowError(error);
  });

  it.each<
    [
      input: Input,
      required: boolean,
      success?: [input: any, result?: any][],
      errors?: [input: any, error: any][],
    ]
  >([
    [
      new Input({ name: 'integer', type: graphql.GraphQLInt }),
      false,
      [
        [undefined, undefined],
        [null, null],
        [10, 10],
      ],
      [
        [{}, 'Expects an "Int", got: {}'],
        [true, 'Expects an "Int", got: true'],
        ['0', 'Expects an "Int", got: \'0\''],
      ],
    ],
    [
      new Input({ name: 'string', type: graphql.GraphQLString }),
      false,
      [
        [undefined, undefined],
        [null, null],
        ['my string', 'my string'],
      ],
      [
        [{}, 'Expects a "String", got: {}'],
        [true, 'Expects a "String", got: true'],
        [0, 'Expects a "String", got: 0'],
      ],
    ],
    [
      new Input({
        name: 'nonNillableString',
        type: nonNillableInputType(graphql.GraphQLString),
      }),
      true,
      undefined,
      [
        [undefined, 'Expects a non-undefined "String"'],
        [null, 'Expects a non-null "String"'],
      ],
    ],
    [
      new Input({
        name: 'nonNillableStringWithDefaultValue',
        type: nonNillableInputType(graphql.GraphQLString),
        defaultValue: 'My default value',
      }),
      false,
      [[undefined, 'My default value']],
      [[null, 'Expects a non-null "String"']],
    ],
    [
      new Input({
        name: 'nonNullableString',
        type: new NonNullableInputType(graphql.GraphQLString),
      }),
      false,
      [
        [undefined, undefined],
        ['my string', 'my string'],
      ],
      [[null, 'Expects a non-null "String"']],
    ],
    [
      new Input({
        name: 'nonOptionalString',
        type: new NonOptionalInputType(graphql.GraphQLString),
      }),
      true,
      [
        [null, null],
        ['my string', 'my string'],
      ],
      [[undefined, 'Expects a non-undefined "String"']],
    ],
    [
      new Input({
        name: 'nonOptionalObject',

        type: new NonOptionalInputType(
          new ObjectInputType({
            name: 'MyObject',
            fields: () => [
              new Input({
                name: 'username',
                type: graphql.GraphQLString,
              }),
            ],
          }),
        ),
      }),
      true,
      [
        [null, null],
        [{}, {}],
        [{ username: undefined }, {}],
        [{ username: null }, { username: null }],
        [{ username: 'yvann' }, { username: 'yvann' }],
      ],
      [[undefined, 'Expects a non-undefined "MyObject"']],
    ],
  ])('"%s" works', (input, required, success = [], errors = []) => {
    expect(input.isRequired()).toBe(required);

    if (input.isPublic()) {
      expect(input.getGraphQLConfig()).toBeDefined();
    }

    success.forEach(([value, result]) =>
      expect(input.parseValue(value)).toEqual(result),
    );

    errors.forEach(([value, error]) =>
      expect(() => input.parseValue(value)).toThrow(error),
    );

    expect(input.getGraphQLConfig()).toMatchSnapshot(input.name);
  });

  it('throws an Error on invalid value', () => {
    let objectInputType: ObjectInputType;

    objectInputType = new ObjectInputType({
      name: 'User',
      fields: () => [
        new Input({
          name: 'firstname',
          type: nonNillableInputType(graphql.GraphQLString),
        }),
        new Input({
          name: 'lastname',
          type: graphql.GraphQLString,
        }),
        new Input<Nillable<number>>({
          name: 'age',
          type: graphql.GraphQLInt,
          assertValue: (value) => {
            if (value < 18) {
              throw new Error('Must be greater than 18');
            }

            return value;
          },
        }),
        new Input({
          name: 'friends',
          type: new NonNullableInputType(
            new ListableInputType(nonNillableInputType(objectInputType)),
          ),
        }),
      ],
    });

    const invalidObject = {
      lastname: 'Boucher',
      friends: [
        { firstname: 'Maxime', friends: null },
        { lastname: 'Hubert', age: 17 },
        {
          firstname: 'Baptiste',
          friends: [
            { firstname: 'Maxime', friends: null },
            { firstname: 'Hubert', friends: 5 },
            null,
            { age: 10 },
          ],
        },
      ],
    };

    expect(objectInputType.validate()).toBeUndefined();

    expect(() => objectInputType.parseValue(invalidObject, testPath))
      .toThrowErrorMatchingInlineSnapshot(`
      ""test" - 2 errors:
      └ "firstname" - Expects a non-undefined "String"
      └ "friends" - 3 errors:
        └ "0.friends" - Expects a non-null "[User!]"
        └ "1" - 2 errors:
          └ "firstname" - Expects a non-undefined "String"
          └ "age" - Must be greater than 18
        └ "2.friends" - 4 errors:
          └ "0.friends" - Expects a non-null "[User!]"
          └ "1.friends" - Expects a plain-object, got: 5
          └ "2" - Expects a non-null "User"
          └ "3" - 2 errors:
            └ "firstname" - Expects a non-undefined "String"
            └ "age" - Must be greater than 18"
    `);

    expect(() =>
      objectInputType.parseValue(invalidObject, addPath(testPath, 'MyUser')),
    ).toThrowErrorMatchingInlineSnapshot(`
      ""test.MyUser" - 2 errors:
      └ "firstname" - Expects a non-undefined "String"
      └ "friends" - 3 errors:
        └ "0.friends" - Expects a non-null "[User!]"
        └ "1" - 2 errors:
          └ "firstname" - Expects a non-undefined "String"
          └ "age" - Must be greater than 18
        └ "2.friends" - 4 errors:
          └ "0.friends" - Expects a non-null "[User!]"
          └ "1.friends" - Expects a plain-object, got: 5
          └ "2" - Expects a non-null "User"
          └ "3" - 2 errors:
            └ "firstname" - Expects a non-undefined "String"
            └ "age" - Must be greater than 18"
    `);
  });
});
