import { describe, expect, it } from '@jest/globals';
import {
  isNonEmptyTrimmedString,
  parseNonEmptyTrimmedString,
} from './non-empty-trimmed-string.js';

describe('NonEmptyTrimmedString', () => {
  it.each([
    ['test ', 'test'],
    [' test', 'test'],
    [' test\n \n \ntest\r \r \rtest\t \t \ttest ', 'test test test test'],
  ])('isNonEmptyTrimmedString(%p) returns false', (input, expected) => {
    expect(isNonEmptyTrimmedString(input)).toBeTruthy();
    expect(parseNonEmptyTrimmedString(input)).toBe(expected);
  });

  it.each([[''], [' '], [' \n \t ']])(
    'parseValue(%p) throws the following Error: %s',
    (value) => {
      expect(isNonEmptyTrimmedString(value)).toBeFalsy();
      expect(() => parseNonEmptyTrimmedString(value)).toThrow(
        `Expects a non-empty trimmed string, got:`,
      );
    },
  );
});
