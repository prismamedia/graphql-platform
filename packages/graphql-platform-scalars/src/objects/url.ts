import {
  addPath,
  castToError,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { URL } from 'node:url';

function parseURL(value: unknown, path?: Path): URL {
  if (value instanceof URL) {
    return value;
  } else if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch (error) {
      throw new UnexpectedValueError('a valid URL', value, {
        path,
        cause: castToError(error),
      });
    }
  }

  throw new UnexpectedValueError('an URL', value, { path });
}

export const GraphQLURL = new graphql.GraphQLScalarType({
  name: 'URL',
  description:
    'A field whose value conforms to the standard URL format as specified in RFC3986.',
  specifiedByURL: 'https://www.ietf.org/rfc/rfc3986.txt',
  parseValue(value: unknown) {
    return parseURL(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.STRING) {
      return parseURL(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseURL(value, addPath(undefined, this.name)).toString();
  },
});
