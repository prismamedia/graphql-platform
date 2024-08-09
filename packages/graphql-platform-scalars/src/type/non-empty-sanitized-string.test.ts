import { describe, expect, it } from '@jest/globals';
import {
  isNonEmptySanitizedString,
  parseNonEmptySanitizedString,
} from './non-empty-sanitized-string.js';

describe('NonEmptySanitizedString', () => {
  it.each([
    ['test ', 'test'],
    [' test', 'test'],
    [
      '\u0000 \t \n \r \u0000 a \u0000 \t \n \r bb \u0000\n\u0000 ccc\u0000 \t \u0000dddd \u0000 ',
      'a bb ccc dddd',
    ],
  ])('parseNonEmptySanitizedString(%p) returns %p', (input, expected) => {
    expect(isNonEmptySanitizedString(input)).toBeTruthy();
    expect(parseNonEmptySanitizedString(input)).toBe(expected);
  });

  it.each([
    [''],
    [' '],
    [' \n \u0000 \t '],
    [
      ` \n <!-- COMMENT 

       COMMENT --> \n `,
    ],
    [
      ` \n test<br
      >test \n `,
    ],
    [' \n test<br />test \n '],
    [' \n test<script>alert("XSS")</script>test \n '],
  ])('parseNonEmptySanitizedString(%p) throws the error: %p', (value) => {
    expect(isNonEmptySanitizedString(value)).toBeFalsy();
    expect(() => parseNonEmptySanitizedString(value)).toThrow();
  });
});
