import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLString,
  printType,
} from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { Input } from '../../../input.js';
import {
  ListableInputType,
  NonNullableInputType,
  nonNillableInputType,
} from '../wrapping.js';
import { ObjectInputType } from './object.js';

describe('ObjectInputType', () => {
  it('is public if it has at least one public field', () => {
    const test0 = new ObjectInputType({
      name: 'Test0',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: GraphQLBoolean,
          public: false,
        }),
      ],
    });

    assert.strictEqual(test0.validate(), undefined);
    assert.strictEqual(test0.isPublic(), true);
  });

  it('supports circular dependencies', () => {
    let test0: ObjectInputType;
    let test1: ObjectInputType;

    test0 = new ObjectInputType({
      name: 'Test0',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: new ListableInputType(test0),
        }),
        new Input({
          name: 'thirdField',
          type: test1,
        }),
      ],
    });

    test1 = new ObjectInputType({
      name: 'Test1',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: test0,
        }),
        new Input({
          name: 'thirdField',
          type: new ListableInputType(test1),
        }),
      ],
    });

    assert.strictEqual(test0.validate(), undefined);
    assert.strictEqual(test1.validate(), undefined);
    assert.strictEqual(test0.isPublic(), true);
    assert.strictEqual(test1.isPublic(), true);
  });

  describe('Public type', () => {
    const type = new ObjectInputType({
      name: 'SimpleInput',
      fields: () => [
        new Input({
          name: 'longitude',
          type: new NonNullableInputType(GraphQLFloat),
        }),
        new Input({
          name: 'latitude',
          type: new NonNullableInputType(GraphQLFloat),
        }),
      ],
    });

    it(`${type} is public`, () => {
      assert.strictEqual(type.isPublic(), true);
    });

    it(`${type} has GraphQL`, ({ assert: { snapshot } }) => {
      snapshot(printType(type.getGraphQLInputType()));
    });

    {
      const cases = [
        [undefined, undefined],
        [null, null],
        [{}, {}],
        [{ longitude: undefined }, {}],
      ] as const;

      cases.forEach(([input, output]) =>
        it(`${type}.parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () =>
          assert.deepEqual(type.parseValue(input), output)),
      );
    }
  });

  describe('Public type with circular reference', () => {
    const type: ObjectInputType = new ObjectInputType({
      name: 'ProfileInput',
      description: 'My profile',
      fields: () => [
        new Input({
          name: 'withDeepReference',
          type: new ObjectInputType({
            name: 'DeepTypeWithReference',
            fields: () => [
              new Input({
                name: 'from',
                type: nonNillableInputType(type),
              }),
              new Input({
                name: 'to',
                type: nonNillableInputType(type),
              }),
            ],
          }),
        }),
        new Input({
          name: 'username',
          type: nonNillableInputType(GraphQLString),
        }),
        new Input({
          name: 'password',
          public: false,
          type: GraphQLString,
        }),
        new Input({
          name: 'age',
          type: GraphQLInt,
          deprecated: true,
        }),
        new Input({
          name: 'friends',
          type: nonNillableInputType(
            new ListableInputType(nonNillableInputType(type)),
          ),
          defaultValue: [],
        }),
      ],
    });

    it(`${type} is valid`, () => {
      assert.strictEqual(type.validate(), undefined);
    });

    it(`${type} is public`, () => {
      assert.strictEqual(type.isPublic(), true);
    });

    it(`${type} has GraphQL`, ({ assert: { snapshot } }) => {
      snapshot(printType(type.getGraphQLInputType()));
    });

    {
      const cases = [
        [undefined, undefined],
        [null, null],
        [{ username: 'yvann' }, { username: 'yvann', friends: [] }],
        [
          { username: 'yvann', friends: [{ username: 'marine' }] },
          { username: 'yvann', friends: [{ username: 'marine', friends: [] }] },
        ],
      ] as const;

      cases.forEach(([input, output]) =>
        it(`${type}.parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () =>
          assert.deepEqual(type.parseValue(input), output)),
      );
    }
  });
});
