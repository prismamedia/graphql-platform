import * as graphql from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  EnumInputType,
  EnumInputValue,
  Input,
  ListableInputType,
  NonNullableInputType,
  NonOptionalInputType,
  ObjectInputType,
  nonNillableInputType,
  type InputConfig,
} from './input.js';
import type { Nillable } from './nil.js';
import { addPath } from './path.js';

describe('Input', () => {
  const testPath = addPath(undefined, 'test');

  it('cannot have an invalid defaultValue', () => {
    const cases: { config: InputConfig; error: string }[] = [
      {
        config: {
          name: 'InputWithInvalidStaticDefaultValue',
          type: graphql.GraphQLInt,
          defaultValue: 'a string',
        },
        error: `/InputWithInvalidStaticDefaultValue/defaultValue - Expects to be valid against the type "Int", got: 'a string'`,
      },
      {
        config: {
          name: 'InputWithInvalidThunkedDefaultValue',
          type: graphql.GraphQLInt,
          defaultValue: () => 'a string',
        },
        error: `/InputWithInvalidThunkedDefaultValue/defaultValue - Expects to be valid against the type "Int", got: 'a string'`,
      },
      {
        config: {
          name: 'InputWithCustomValidationAndInvalidThunkedDefaultValue',
          type: graphql.GraphQLInt,
          parser: (value) => {
            if (value < 18) {
              throw new Error('Must be greater than 18');
            }
            return value;
          },
          defaultValue: () => 16,
        },
        error: `/InputWithCustomValidationAndInvalidThunkedDefaultValue/defaultValue - Expects to be valid against the type "Int" and the custom-parser, got: 16`,
      },
    ] as const;

    cases.forEach(({ config, error }) => {
      assert.throws(() => new Input(config), { message: error });
    });
  });

  it('works with various input configurations', () => {
    const cases: {
      input: Input;
      required: boolean;
      success: any[];
      errors: [input: any, error: string][];
    }[] = [
      {
        input: new Input({ name: 'integer', type: graphql.GraphQLInt }),
        required: false,
        success: [
          [undefined, undefined],
          [null, null],
          [10, 10],
        ],
        errors: [
          [{}, '/integer - Expects an "Int", got: {}'],
          [true, '/integer - Expects an "Int", got: true'],
          ['0', '/integer - Expects an "Int", got: \'0\''],
        ],
      },
      {
        input: new Input({ name: 'string', type: graphql.GraphQLString }),
        required: false,
        success: [
          [undefined, undefined],
          [null, null],
          ['my string', 'my string'],
        ],
        errors: [
          [{}, '/string - Expects a "String", got: {}'],
          [true, '/string - Expects a "String", got: true'],
          [0, '/string - Expects a "String", got: 0'],
        ],
      },
      {
        input: new Input({
          name: 'nonNillableString',
          type: nonNillableInputType(graphql.GraphQLString),
        }),
        required: true,
        success: [['a string', 'a string']],
        errors: [
          [
            undefined,
            '/nonNillableString - Expects a non-undefined "String", got: undefined',
          ],
          [null, '/nonNillableString - Expects a non-null "String", got: null'],
        ],
      },
      {
        input: new Input({
          name: 'nonNillableStringWithDefaultValue',
          type: nonNillableInputType(graphql.GraphQLString),
          defaultValue: 'My default value',
        }),
        required: false,
        success: [[undefined, 'My default value']],
        errors: [
          [
            null,
            '/nonNillableStringWithDefaultValue - Expects a non-null "String", got: null',
          ],
        ],
      },
      {
        input: new Input({
          name: 'nonNullableString',
          type: new NonNullableInputType(graphql.GraphQLString),
        }),
        required: false,
        success: [
          [undefined, undefined],
          ['my string', 'my string'],
        ],
        errors: [
          [null, '/nonNullableString - Expects a non-null "String", got: null'],
        ],
      },
      {
        input: new Input({
          name: 'nonOptionalString',
          type: new NonOptionalInputType(graphql.GraphQLString),
        }),
        required: true,
        success: [
          [null, null],
          ['my string', 'my string'],
        ],
        errors: [
          [
            undefined,
            '/nonOptionalString - Expects a non-undefined "String", got: undefined',
          ],
        ],
      },
      {
        input: new Input({
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
        required: true,
        success: [
          [null, null],
          [{}, {}],
          [{ username: undefined }, {}],
          [{ username: null }, { username: null }],
          [{ username: 'yvann' }, { username: 'yvann' }],
        ],
        errors: [
          [
            undefined,
            '/nonOptionalObject - Expects a non-undefined "MyObject", got: undefined',
          ],
        ],
      },
    ] as const;

    cases.forEach(({ input, required, success = [], errors = [] }) => {
      assert.strictEqual(input.isRequired(), required);

      if (input.isPublic()) {
        assert(input.getGraphQLConfig());
      }

      success.forEach(([value, result]) =>
        assert.deepEqual(input.parseValue(value), result),
      );

      errors.forEach(([value, error]) =>
        assert.throws(() => input.parseValue(value), { message: error }),
      );
    });
  });

  it('throws an error on invalid value', () => {
    let objectInputType: ObjectInputType = new ObjectInputType({
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
          parser: (value) => {
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
        new Input({
          name: 'status',
          optional: false,
          type: new EnumInputType({
            name: 'UserStatus',
            values: [
              new EnumInputValue({ value: 'PRIVATE', public: false }),
              new EnumInputValue({ value: 'PUBLIC' }),
            ],
          }),
          defaultValue: 'PRIVATE',
        }),
        new Input({
          name: 'roles',
          type: new ListableInputType(
            nonNillableInputType(
              new EnumInputType({
                name: 'UserRole',
                values: [
                  new EnumInputValue({ value: 'ADMIN', public: false }),
                  new EnumInputValue({ value: 'CLIENT' }),
                ],
              }),
            ),
          ),
          defaultValue: ['ADMIN', 'CLIENT'],
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

    assert.strictEqual(objectInputType.validate(), undefined);

    assert.throws(() => objectInputType.parseValue(invalidObject, testPath), {
      message: `/test - 2 errors:
└ ./firstname - Expects a non-undefined "String", got: undefined
└ ./friends - 3 errors:
  └ ./0/friends - Expects a non-null "[User!]", got: null
  └ ./1 - 2 errors:
    └ ./firstname - Expects a non-undefined "String", got: undefined
    └ ./age - Must be greater than 18
  └ ./2/friends - 4 errors:
    └ ./0/friends - Expects a non-null "[User!]", got: null
    └ ./1/friends - Expects a plain-object, got: 5
    └ ./2 - Expects a non-null "User", got: null
    └ ./3 - 2 errors:
      └ ./firstname - Expects a non-undefined "String", got: undefined
      └ ./age - Must be greater than 18`,
    });

    assert.throws(
      () =>
        objectInputType.parseValue(invalidObject, addPath(testPath, 'MyUser')),
      {
        message: `/test/MyUser - 2 errors:
└ ./firstname - Expects a non-undefined "String", got: undefined
└ ./friends - 3 errors:
  └ ./0/friends - Expects a non-null "[User!]", got: null
  └ ./1 - 2 errors:
    └ ./firstname - Expects a non-undefined "String", got: undefined
    └ ./age - Must be greater than 18
  └ ./2/friends - 4 errors:
    └ ./0/friends - Expects a non-null "[User!]", got: null
    └ ./1/friends - Expects a plain-object, got: 5
    └ ./2 - Expects a non-null "User", got: null
    └ ./3 - 2 errors:
      └ ./firstname - Expects a non-undefined "String", got: undefined
      └ ./age - Must be greater than 18`,
      },
    );
  });
});
