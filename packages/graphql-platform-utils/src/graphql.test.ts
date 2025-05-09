import * as graphql from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  createGraphQLEnumType,
  parseGraphQLLeafValue,
  serializeGraphQLOutputType,
} from './graphql.js';

describe('GraphQL', () => {
  it('parses valid values', () => {
    const cases = [
      [graphql.GraphQLBoolean, undefined],
      [graphql.GraphQLBoolean, null],
      [graphql.GraphQLBoolean, true],
      [graphql.GraphQLString, 'A string'],
      [
        new graphql.GraphQLEnumType({
          name: 'AnEnumTest',
          values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
        }),
        'TWO',
      ],
    ] as const;

    cases.forEach(([type, value]) => {
      assert.strictEqual(parseGraphQLLeafValue(type, value), value);
    });
  });

  it('serializes valid values', () => {
    const cases = [
      [graphql.GraphQLBoolean, null, null],
      [graphql.GraphQLBoolean, true, true],
      [graphql.GraphQLString, 'A string', 'A string'],
      [
        new graphql.GraphQLEnumType({
          name: 'AnEnumTest',
          values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
        }),
        'TWO',
        'two',
      ],
      [
        new graphql.GraphQLObjectType({
          name: 'AnObjectTypeTest',
          fields: {
            key1: {
              type: graphql.GraphQLString,
            },
            key2: {
              type: new graphql.GraphQLList(
                new graphql.GraphQLObjectType({
                  name: 'AnObjectTypeTest2',
                  fields: {
                    key3: {
                      type: graphql.GraphQLString,
                    },
                    key4: {
                      type: new graphql.GraphQLEnumType({
                        name: 'AnEnumTest3',
                        values: {
                          first: { value: 'FIRST' },
                          two: { value: 'TWO' },
                        },
                      }),
                    },
                  },
                }),
              ),
            },
          },
        }),
        {
          key1: 'A string',
          key2: [{ key3: 'A string', key4: 'TWO' }, { key4: 'FIRST' }],
        },
        {
          key1: 'A string',
          key2: [{ key3: 'A string', key4: 'two' }, { key4: 'first' }],
        },
      ],
    ] as const;

    cases.forEach(([type, input, output]) => {
      assert.deepEqual(serializeGraphQLOutputType(type, input), output);
    });
  });

  it('throws error for invalid values', () => {
    const cases = [
      [
        graphql.GraphQLBoolean,
        'A string',
        'Expects a "Boolean", got: \'A string\'',
      ],
      [
        new graphql.GraphQLEnumType({
          name: 'MyEnum',
          values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
        }),
        'THIRD',
        'Expects a "MyEnum" (= a value among "FIRST, TWO"), got: \'THIRD\'',
      ],
    ] as const;

    cases.forEach(([type, value, error]) => {
      assert.throws(() => parseGraphQLLeafValue(type, value), {
        message: error,
      });
    });
  });

  it('creates GraphQLEnumType from numeric enum', () => {
    enum MyNumericEnum {
      ONE,
      TWO,
      THREE,
    }

    const type = createGraphQLEnumType('MyNumericEnum', MyNumericEnum, {
      description: 'My numeric enum',
    });

    assert.strictEqual(
      graphql.printType(type),
      '"""My numeric enum"""\nenum MyNumericEnum {\n  ONE\n  TWO\n  THREE\n}',
    );

    assert.deepStrictEqual(
      type.getValues().map(({ name, value }) => ({ name, value })),
      [
        { name: 'ONE', value: 0 },
        { name: 'TWO', value: 1 },
        { name: 'THREE', value: 2 },
      ],
    );
  });

  it('creates GraphQLEnumType from string enum', () => {
    enum MyStringEnum {
      ONE = 'one',
      TWO = 'two',
      THREE = 'three',
    }

    const type = createGraphQLEnumType('MyStringEnum', MyStringEnum);

    assert.match(
      graphql.printType(type),
      /enum MyStringEnum {\n  ONE\n  TWO\n  THREE\n}/,
    );

    assert.deepStrictEqual(
      type.getValues().map(({ name, value }) => ({ name, value })),
      [
        { name: 'ONE', value: 'one' },
        { name: 'TWO', value: 'two' },
        { name: 'THREE', value: 'three' },
      ],
    );
  });

  it('creates GraphQLEnumType from mixed enum', () => {
    enum MyMixedEnum {
      ONE = 0,
      TWO = 'two',
      THREE = 2,
    }

    const type = createGraphQLEnumType('MyMixedEnum', MyMixedEnum);

    assert.match(
      graphql.printType(type),
      /enum MyMixedEnum {\n  ONE\n  TWO\n  THREE\n}/,
    );

    assert.deepStrictEqual(
      type.getValues().map(({ name, value }) => ({ name, value })),
      [
        { name: 'ONE', value: 0 },
        { name: 'TWO', value: 'two' },
        { name: 'THREE', value: 2 },
      ],
    );
  });
});
