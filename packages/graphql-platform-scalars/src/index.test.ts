import { GraphQLScalarType } from 'graphql';
import { Scalars, ScalarType, scalarTypes } from './index';

describe('GraphQL Platform Scalars', () => {
  it.each(
    scalarTypes.flatMap((scalarType): [GraphQLScalarType, any][] => [
      [scalarType, undefined],
      [scalarType, null],
    ]),
  )('throws an Error on %s.parseValue(%s)', (scalarType, value) => {
    expect(() => scalarType.parseValue(value)).toThrowError();
  });

  it.each<[ScalarType['name'], any, any]>([
    // BigInt
    ['BigInt', 123, BigInt('123')],
    ['BigInt', BigInt('321'), BigInt('321')],

    // DateTime
    [
      'DateTime',
      '2020-01-01T01:01:01.123Z',
      new Date('2020-01-01T01:01:01.123Z'),
    ],
    [
      'DateTime',
      new Date('2020-02-02T02:02:02.321Z'),
      new Date('2020-02-02T02:02:02.321Z'),
    ],
  ])('%s.parseValue(%p) = %p', (scalarTypeName, value, parsedValue) => {
    expect(Scalars[scalarTypeName].parseValue(value)).toEqual(parsedValue);
  });
});
