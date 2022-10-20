import { GraphQLDate } from './date.js';

describe('Date', () => {
  it.each([
    [
      '',
      "Expects a date string compliant with the ISO 8601 extended format, got: ''",
    ],
    ['2000-02-30', "Expects a valid date, got: '2000-02-30'"],
    [
      '2000-02-15T10:00:00Z',
      "Expects a date string compliant with the ISO 8601 extended format, got: '2000-02-15T10:00:00Z'",
    ],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLDate.parseValue(input)).toThrowError(error);
  });

  it.each([
    ['1234-05-06', new Date('1234-05-06T00:00:00Z')],
    [new Date('1234-05-06'), new Date('1234-05-06T00:00:00Z')],
    [new Date('1234-05-06T00:00:00Z'), new Date('1234-05-06T00:00:00Z')],
  ])('parseValue(%p) = %p', (input, expected) => {
    expect(GraphQLDate.parseValue(input)).toEqual(expected);
  });

  it.each([
    ['1234-05-06', '1234-05-06'],
    [new Date('1234-05-06'), '1234-05-06'],
  ])('serialize(%p) = %p', (input, expected) => {
    expect(GraphQLDate.serialize(input)).toEqual(expected);
  });
});
