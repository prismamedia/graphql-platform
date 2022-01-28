import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

// @see https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const GRAPHQL_EMAIL_ADDRESS_REGEX =
  /^[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*$/i;

function parseEmailAddress(value: unknown, path?: Path): string {
  if (typeof value === 'string' && GRAPHQL_EMAIL_ADDRESS_REGEX.test(value)) {
    return value;
  }

  throw new UnexpectedValueError('an email address', value, { path });
}

export const GraphQLEmailAddress = new graphql.GraphQLScalarType({
  name: 'EmailAddress',
  specifiedByURL:
    'https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address',
  parseValue(value: unknown) {
    return parseEmailAddress(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.STRING) {
      return parseEmailAddress(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseEmailAddress(value, addPath(undefined, this.name));
  },
});
