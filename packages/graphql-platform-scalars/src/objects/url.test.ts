import { URL } from 'url';
import { GraphQLURL } from './url';

describe('URL', () => {
  it.each(['https//www.ietf.org/rfc/rfc3986.txt', 'localhost'])(
    'throws an Error on invalid value "%s"',
    (input) => {
      expect(() => GraphQLURL.parseValue(input)).toThrowError(
        /URL expects an url, got the error: /,
      );
    },
  );

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
