import { describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import { createGraphQLEnumType, parseGraphQLLeafValue } from './graphql.js';

describe('GraphQL', () => {
  it.each([
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
  ])('%p.parseValue(%p) = %p', (type, value) => {
    expect(parseGraphQLLeafValue(type, value)).toEqual(value);
  });

  it.each([
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
  ])('%p.parseValue(%p) throws an Error', (type, value, error) => {
    expect(() => parseGraphQLLeafValue(type, value)).toThrow(error);
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

    expect(graphql.printType(type)).toMatchInlineSnapshot(`
      """"My numeric enum"""
      enum MyNumericEnum {
        ONE
        TWO
        THREE
      }"
    `);

    expect(
      type.getValues().map(({ name, value }) => ({ name, value })),
    ).toEqual([
      { name: 'ONE', value: 0 },
      { name: 'TWO', value: 1 },
      { name: 'THREE', value: 2 },
    ]);
  });

  it('creates GraphQLEnumType from string enum', () => {
    enum MyStringEnum {
      ONE = 'one',
      TWO = 'two',
      THREE = 'three',
    }

    const type = createGraphQLEnumType('MyStringEnum', MyStringEnum);

    expect(graphql.printType(type)).toMatchInlineSnapshot(`
      "enum MyStringEnum {
        ONE
        TWO
        THREE
      }"
    `);

    expect(
      type.getValues().map(({ name, value }) => ({ name, value })),
    ).toEqual([
      { name: 'ONE', value: 'one' },
      { name: 'TWO', value: 'two' },
      { name: 'THREE', value: 'three' },
    ]);
  });

  it('creates GraphQLEnumType from mixed enum', () => {
    enum MyMixedEnum {
      ONE = 0,
      TWO = 'two',
      THREE = 2,
    }

    const type = createGraphQLEnumType('MyMixedEnum', MyMixedEnum);

    expect(graphql.printType(type)).toMatchInlineSnapshot(`
      "enum MyMixedEnum {
        ONE
        TWO
        THREE
      }"
    `);

    expect(
      type.getValues().map(({ name, value }) => ({ name, value })),
    ).toEqual([
      { name: 'ONE', value: 0 },
      { name: 'TWO', value: 'two' },
      { name: 'THREE', value: 2 },
    ]);
  });
});
