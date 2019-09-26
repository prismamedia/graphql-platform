import { scalarTypeByName, scalarTypes, TScalarType } from '.';

describe('GraphQL Platform Scalars', () => {
  it.each(scalarTypes)(
    'throws an Error on %s.parseValue(undefined)',
    (scalarType) => {
      expect(() => scalarType.parseValue(undefined)).toThrowError();
    },
  );

  it.each(scalarTypes)(
    'throws an Error on %s.parseValue(null)',
    (scalarType) => {
      expect(() => scalarType.parseValue(null)).toThrowError();
    },
  );

  it.each<[TScalarType['name'], any, any]>([
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
    expect(scalarTypeByName[scalarTypeName].parseValue(value)).toEqual(
      parsedValue,
    );
  });
});
