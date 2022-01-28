import * as graphql from 'graphql';
import { parseGraphQLLeafValue } from './graphql.js';

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
    expect(() => parseGraphQLLeafValue(type, value)).toThrowError(error);
  });
});
