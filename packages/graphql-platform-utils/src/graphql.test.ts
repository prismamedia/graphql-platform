import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLString,
} from 'graphql';
import { assertLeafValue, GraphQLArgumentConfigMap } from './graphql';

describe('GraphQL', () => {
  it('provides some useful types', () => {
    const withoutArgumentMap: GraphQLArgumentConfigMap<undefined> = undefined;

    const withArgumentMap: GraphQLArgumentConfigMap<{
      skip: number;
      first: number;
    }> = {
      skip: {
        type: GraphQLInt,
      },
      first: {
        type: GraphQLInt,
      },
    };

    const withOptionalArgumentMap: GraphQLArgumentConfigMap<{
      skip?: number;
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
    };
  });

  it('spots some definition errors', () => {
    // @ts-expect-error
    const withMissingArgumentMap: GraphQLArgumentConfigMap<{
      skip: number;
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
    };

    const withExtraArgumentMap: GraphQLArgumentConfigMap<{
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
      // @ts-expect-error
      where: {
        type: GraphQLInt,
      },
    };
  });

  it.each([
    [GraphQLBoolean, true],
    [GraphQLString, 'A string'],
    [
      new GraphQLEnumType({
        name: 'An enum test',
        values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
      }),
      'TWO',
    ],
  ])('%p.parseValue(%p) = %p', (type, value) => {
    expect(assertLeafValue(type, value)).toEqual(value);
  });

  it.each([
    [GraphQLBoolean, undefined],
    [GraphQLBoolean, null],
    [GraphQLBoolean, 'A string'],
    [
      new GraphQLEnumType({
        name: 'An enum test',
        values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
      }),
      'THIRD',
    ],
  ])('%p.parseValue(%p) throws an Error', (type, value) => {
    expect(() => assertLeafValue(type, value)).toThrowError();
  });
});
