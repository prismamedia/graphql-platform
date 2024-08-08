import { describe, expect, it } from '@jest/globals';
import {
  isNonEmptyTrimmedString,
  parseNonEmptyTrimmedString,
} from './non-empty-trimmed-string.js';

describe('NonEmptyTrimmedString', () => {
  it.each([
    ['test ', 'test'],
    [' test', 'test'],
    ['\t \n \r  a bb ccc dddd \t \n \r ', 'a bb ccc dddd'],
  ])('parseNonEmptyTrimmedString(%p) returns %p', (input, expected) => {
    expect(isNonEmptyTrimmedString(input)).toBeTruthy();
    expect(parseNonEmptyTrimmedString(input)).toBe(expected);
  });

  it.each([[''], [' '], [' \n \t ']])(
    'parseNonEmptyTrimmedString(%p) throws the error: %s',
    (value) => {
      expect(isNonEmptyTrimmedString(value)).toBeFalsy();
      expect(() => parseNonEmptyTrimmedString(value)).toThrow(
        `Expects a non-empty trimmed string, got:`,
      );
    },
  );
});
