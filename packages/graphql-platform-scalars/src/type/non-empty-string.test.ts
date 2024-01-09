import { describe, expect, it } from '@jest/globals';
import { GraphQLNonEmptyString } from './non-empty-string.js';

describe('NonEmptyString', () => {
  it.each([[' '], [' \n \t ']])('parseValue(%p)', (value) => {
    expect(GraphQLNonEmptyString.parseValue(value)).toEqual(value);
  });

  it.each([['']])('parseValue(%p) throws the following Error: %s', (value) => {
    expect(() => GraphQLNonEmptyString.parseValue(value)).toThrow(
      `Expects a non-empty string, got:`,
    );
  });
});
