import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import {
  GraphQLNonEmptyTrimmedString,
  isNonEmptyTrimmedString,
} from './non-empty-trimmed-string.js';

describe('NonEmptyTrimmedString', () => {
  describe('invalids', () => {
    [[''], [' '], [' \n \t ']].forEach(([value]) => {
      it(`parseNonEmptyTrimmedString(${value}) throws an error`, () => {
        assert.ok(!isNonEmptyTrimmedString(value));
        assert.throws(() => GraphQLNonEmptyTrimmedString.parseValue(value), {
          message: new RegExp(`^Expects a non-empty trimmed string, got:`),
        });
      });
    });
  });

  describe('valids', () => {
    [
      ['test ', 'test'],
      [' test', 'test'],
      ['\t \n \r  a bb ccc dddd \t \n \r ', 'a bb ccc dddd'],
    ].forEach(([input, expected]) => {
      it(`parseNonEmptyTrimmedString(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.ok(isNonEmptyTrimmedString(input));
        assert.strictEqual(
          GraphQLNonEmptyTrimmedString.parseValue(input),
          expected,
        );
      });
    });
  });
});
