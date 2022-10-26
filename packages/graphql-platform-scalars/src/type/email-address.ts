import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

// @see https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const GRAPHQL_EMAIL_ADDRESS_REGEX =
  /^[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*$/i;

export function parseEmailAddress(value: unknown, path?: utils.Path): string {
  if (typeof value === 'string' && GRAPHQL_EMAIL_ADDRESS_REGEX.test(value)) {
    return value;
  }

  throw new utils.UnexpectedValueError('an email address', value, { path });
}

export const GraphQLEmailAddress = new graphql.GraphQLScalarType({
  name: 'EmailAddress',
  specifiedByURL:
    'https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address',
  parseValue(value: unknown) {
    return parseEmailAddress(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseEmailAddress(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseEmailAddress(value);
  },
});
