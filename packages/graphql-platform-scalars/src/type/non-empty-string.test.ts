import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLNonEmptyString } from './non-empty-string.js';

describe('NonEmptyString', () => {
  describe('invalids', () => {
    [['']].forEach(([value]) => {
      it(`parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLNonEmptyString.parseValue(value), {
          message: new RegExp(`^Expects a non-empty string, got:`),
        });
      });
    });
  });

  describe('valids', () => {
    [[' '], [' \n \t ']].forEach(([value]) => {
      it(`parseValue(${inspect(value, undefined, 5)}) = ${inspect(value, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLNonEmptyString.parseValue(value), value);
      });
    });
  });
});
