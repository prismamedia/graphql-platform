import { describe, expect, it } from '@jest/globals';
import { isSlug, parseSlug } from './slug.js';

describe('NonEmptySlug', () => {
  it.each(['a', 'a0', '0a', 'a-a', 'a0-0a', 'a_a', 'a0_0a'])(
    'parseNonEmptySlug(%p)',
    (input) => {
      expect(isSlug(input)).toBeTruthy();
      expect(parseSlug(input)).toBe(input);
    },
  );

  it.each([' ', ' \n \t ', '-a', 'a-', 'a-_-a', 'a0-_-0a'])(
    'parseNonEmptySlug(%p) throws an error',
    (input) => {
      expect(isSlug(input)).toBeFalsy();
      expect(() => parseSlug(input)).toThrow(`Expects a slug, got:`);
    },
  );
});
