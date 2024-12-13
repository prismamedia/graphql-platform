import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import {
  GraphQLNonEmptySanitizedString,
  isNonEmptySanitizedString,
} from './non-empty-sanitized-string.js';

describe('NonEmptySanitizedString', () => {
  describe('invalids', () => {
    [
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
    ].forEach(([value]) => {
      it(`parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
        assert.ok(!isNonEmptySanitizedString(value));
        assert.throws(() => GraphQLNonEmptySanitizedString.parseValue(value));
      });
    });
  });

  describe('valids', () => {
    [
      ['test ', 'test'],
      [' test', 'test'],
      [
        '\u0000 \t \n \r \u0000 a \u0000 \t \n \r bb \u0000\n\u0000 ccc\u0000 \t \u0000dddd \u0000 ',
        'a bb ccc dddd',
      ],
    ].forEach(([input, expected]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.ok(isNonEmptySanitizedString(input));
        assert.strictEqual(
          GraphQLNonEmptySanitizedString.parseValue(input),
          expected,
        );
      });
    });
  });
});
