import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLSlug, isSlug } from './slug.js';

describe('NonEmptySlug', () => {
  describe('invalids', () => {
    [' ', ' \n \t ', '-a', 'a-', 'a-_-a', 'a0-_-0a'].forEach((input) => {
      it(`parseNonEmptySlug(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.ok(!isSlug(input));
        assert.throws(() => GraphQLSlug.parseValue(input), {
          message: new RegExp(`^Expects a slug, got:`),
        });
      });
    });
  });

  describe('valids', () => {
    ['a', 'a0', '0a', 'a-a', 'a0-0a', 'a_a', 'a0_0a'].forEach((input) => {
      it(`parseNonEmptySlug(${inspect(input, undefined, 5)})`, () => {
        assert.ok(isSlug(input));
        assert.strictEqual(GraphQLSlug.parseValue(input), input);
      });
    });
  });
});
