import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { URL } from 'node:url';

function parseURL(value: unknown, path?: utils.Path): URL {
  if (value instanceof URL) {
    return value;
  } else if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch (error) {
      throw new utils.UnexpectedValueError('a valid URL', value, {
        path,
        cause: utils.castToError(error),
      });
    }
  }

  throw new utils.UnexpectedValueError('an URL', value, { path });
}

export const GraphQLURL = new graphql.GraphQLScalarType({
  name: 'URL',
  description:
    'A field whose value conforms to the standard URL format as specified in RFC3986.',
  specifiedByURL: 'https://www.ietf.org/rfc/rfc3986.txt',
  parseValue(value: unknown) {
    return parseURL(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseURL(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseURL(value).toString();
  },
});
