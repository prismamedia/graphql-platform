import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLDateTime } from './date-time.js';

describe('DateTime', () => {
  describe('invalids', () => {
    [
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
    ].forEach(([input, error]) => {
      it(`parseValue(${input}) throws an error`, () => {
        assert.throws(() => GraphQLDateTime.parseValue(input), {
          message: error,
        });
      });
    });
  });

  describe('valids', () => {
    [
      ['2000-01-23T01:23:45.678Z', new Date('2000-01-23T01:23:45.678Z')],
      ['2000-01-23T01:23:45.678+06:00', new Date('2000-01-22T19:23:45.678Z')],
      ['2000-01-23T01:23:45.678-06:00', new Date('2000-01-23T07:23:45.678Z')],
      ['2000-01-23T01:23:45Z', new Date('2000-01-23T01:23:45Z')],
    ].forEach(([input, expected]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.deepEqual(GraphQLDateTime.parseValue(input), expected);
      });
    });

    [
      ['2000-01-23T01:23:45.678Z', '2000-01-23T01:23:45.678Z'],
      ['2000-01-23T01:23:45.678+06:00', '2000-01-22T19:23:45.678Z'],
      ['2000-01-23T01:23:45.678-06:00', '2000-01-23T07:23:45.678Z'],
      ['2000-01-23T01:23:45Z', '2000-01-23T01:23:45.000Z'],
    ].forEach(([input, expected]) => {
      it(`serialize(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLDateTime.serialize(input), expected);
      });
    });
  });
});
