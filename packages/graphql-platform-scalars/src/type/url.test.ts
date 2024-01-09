import { describe, expect, it } from '@jest/globals';
import { URL } from 'node:url';
import { GraphQLURL } from './url.js';

describe('URL', () => {
  it.each([
    'https//www.ietf.org/rfc/rfc3986.txt',
    'localhost',
    'www.adrian-grenier.net',
  ])('throws an Error on invalid value: %s', (input) => {
    expect(() => GraphQLURL.parseValue(input)).toThrow(
      `Expects a valid URL, got: '${input}'`,
    );
  });

  it('serializes', () => {
    expect(
      GraphQLURL.serialize('https://www.ietf.org/rfc/rfc3986.txt'),
    ).toEqual('https://www.ietf.org/rfc/rfc3986.txt');

    expect(
      GraphQLURL.serialize(new URL('https://www.ietf.org/rfc/rfc3986.txt')),
    ).toEqual('https://www.ietf.org/rfc/rfc3986.txt');
  });

  it('parses', () => {
    expect(
      GraphQLURL.parseValue('https://www.ietf.org/rfc/rfc3986.txt'),
    ).toBeInstanceOf(URL);

    expect(
      GraphQLURL.parseValue(new URL('https://www.ietf.org/rfc/rfc3986.txt')),
    ).toBeInstanceOf(URL);
  });
});
