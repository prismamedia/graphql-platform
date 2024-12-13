import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLEmailAddress } from './email-address.js';

describe('EmailAddress', () => {
  describe('invalids', () => {
    [['y vann.boucher@gmail.com'], [' ']].forEach(([value]) => {
      it(`parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLEmailAddress.parseValue(value), {
          message: new RegExp(`^Expects an email address, got:`),
        });
      });
    });
  });

  describe('valids', () => {
    ['yvann.boucher@gmail.com'].forEach((input) => {
      it(`parseValue(${inspect(input, undefined, 5)})`, () => {
        assert.strictEqual(GraphQLEmailAddress.parseValue(input), input);
      });
    });
  });
});
