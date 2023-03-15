import { describe, expect, it } from '@jest/globals';
import { GraphQLEmailAddress } from './email-address.js';

describe('EmailAddress', () => {
  it.each([['y vann.boucher@gmail.com'], [' ']])(
    'parseValue(%p) throws the following Error: %s',
    (value) => {
      expect(() => GraphQLEmailAddress.parseValue(value)).toThrowError(
        `Expects an email address, got:`,
      );
    },
  );

  it.each(['yvann.boucher@gmail.com'])('parseValue(%s)', (input) => {
    expect(GraphQLEmailAddress.parseValue(input)).toEqual(input);
  });
});
