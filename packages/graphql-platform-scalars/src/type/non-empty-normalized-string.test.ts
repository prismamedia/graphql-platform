import { describe, expect, it } from '@jest/globals';
import {
  isNonEmptyNormalizedString,
  parseNonEmptyNormalizedString,
} from './non-empty-normalized-string.js';

describe('NonEmptyNormalizedString', () => {
  it.each([
    ['test ', 'test'],
    [' test', 'test'],
    [
      '\u0000 \t \n \r \u0000 a \u0000 \t \n \r bb \u0000\n\u0000 ccc\u0000 \t \u0000dddd \u0000 ',
      'a bb ccc dddd',
    ],
  ])('parseNonEmptyNormalizedString(%p) returns %p', (input, expected) => {
    expect(isNonEmptyNormalizedString(input)).toBeTruthy();
    expect(parseNonEmptyNormalizedString(input)).toBe(expected);
  });

  it.each([[''], [' '], [' \n \u0000 \t ']])(
    'parseNonEmptyNormalizedString(%p) throws the error: %s',
    (value) => {
      expect(isNonEmptyNormalizedString(value)).toBeFalsy();
      expect(() => parseNonEmptyNormalizedString(value)).toThrow(
        `Expects a non-empty normalized string, got:`,
      );
    },
  );
});
