import { describe, expect, it } from '@jest/globals';
import { GraphQLNonEmptyTrimmedString } from './non-empty-trimmed-string.js';

describe('NonEmptyTrimmedString', () => {
  it.each([[''], [' '], [' \n \t ']])(
    'parseValue(%p) throws the following Error: %s',
    (value) => {
      expect(() => GraphQLNonEmptyTrimmedString.parseValue(value)).toThrowError(
        `Expects a non-empty trimmed string, got:`,
      );
    },
  );
});
