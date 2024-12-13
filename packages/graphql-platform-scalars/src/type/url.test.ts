import assert from 'node:assert';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { inspect } from 'node:util';
import { GraphQLURL } from './url.js';

describe('URL', () => {
  describe('invalids', () => {
    [
      'https//www.ietf.org/rfc/rfc3986.txt',
      'localhost',
      'www.adrian-grenier.net',
    ].forEach((input) => {
      it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLURL.parseValue(input), {
          message: `Expects a valid URL, got: '${input}'`,
        });
      });
    });
  });

  describe('valids', () => {
    [
      'https://www.ietf.org/rfc/rfc3986.txt',
      new URL('https://www.ietf.org/rfc/rfc3986.txt'),
    ].forEach((input) => {
      it(`parseValue(${input})`, () => {
        assert.ok(GraphQLURL.parseValue(input) instanceof URL);
      });

      it(`serialize(${input})`, () => {
        assert.strictEqual(
          GraphQLURL.serialize(input),
          'https://www.ietf.org/rfc/rfc3986.txt',
        );
      });
    });
  });
});
