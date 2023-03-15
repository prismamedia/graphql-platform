import { describe, expect, it } from '@jest/globals';
import { GraphQLDateTime } from './date-time.js';

describe('DateTime', () => {
  it.each([
    [
      '',
      "Expects a date-time string compliant with the ISO 8601 extended format, got: ''",
    ],
    [
      '2000-02-30',
      "Expects a date-time string compliant with the ISO 8601 extended format, got: '2000-02-30'",
    ],
    [
      '2000-02-30T10:00:00',
      "Expects a date-time string compliant with the ISO 8601 extended format, got: '2000-02-30T10:00:00'",
    ],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLDateTime.parseValue(input)).toThrowError(error);
  });

  it.each([
    ['2000-01-23T01:23:45.678Z', new Date('2000-01-23T01:23:45.678Z')],
    ['2000-01-23T01:23:45.678+06:00', new Date('2000-01-22T19:23:45.678Z')],
    ['2000-01-23T01:23:45.678-06:00', new Date('2000-01-23T07:23:45.678Z')],
    ['2000-01-23T01:23:45Z', new Date('2000-01-23T01:23:45Z')],
  ])('parseValue(%p) = %p', (input, expected) => {
    expect(GraphQLDateTime.parseValue(input)).toEqual(expected);
  });

  it.each([
    ['2000-01-23T01:23:45.678Z', '2000-01-23T01:23:45.678Z'],
    ['2000-01-23T01:23:45.678+06:00', '2000-01-22T19:23:45.678Z'],
    ['2000-01-23T01:23:45.678-06:00', '2000-01-23T07:23:45.678Z'],
    ['2000-01-23T01:23:45Z', '2000-01-23T01:23:45.000Z'],
  ])('serialize(%p) = %p', (input, expected) => {
    expect(GraphQLDateTime.serialize(input)).toEqual(expected);
  });
});
