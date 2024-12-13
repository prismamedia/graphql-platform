import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLDate } from './date.js';

describe('Date', () => {
  describe('invalids', () => {
    [
      [
        '',
        "Expects a date string compliant with the ISO 8601 extended format, got: ''",
      ],
      ['2000-02-30', "Expects a valid date, got: '2000-02-30'"],
      [
        '2000-02-15T10:00:00Z',
        "Expects a date string compliant with the ISO 8601 extended format, got: '2000-02-15T10:00:00Z'",
      ],
    ].forEach(([input, error]) => {
      it(`parseValue(${input}) throws an error`, () => {
        assert.throws(() => GraphQLDate.parseValue(input), { message: error });
      });
    });
  });

  describe('valids', () => {
    [
      ['1234-05-06', new Date('1234-05-06T00:00:00Z')],
      [new Date('1234-05-06'), new Date('1234-05-06T00:00:00Z')],
      [new Date('1234-05-06T00:00:00Z'), new Date('1234-05-06T00:00:00Z')],
    ].forEach(([input, expected]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.deepEqual(GraphQLDate.parseValue(input), expected);
      });
    });

    [
      ['1234-05-06', '1234-05-06'],
      [new Date('1234-05-06'), '1234-05-06'],
    ].forEach(([input, expected]) => {
      it(`serialize(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLDate.serialize(input), expected);
      });
    });
  });
});
