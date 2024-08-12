import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const validation = /^[a-z0-9](?:[-_]?[a-z0-9])*$/;

export const isSlug = (value: unknown): value is string =>
  typeof value === 'string' && validation.test(value);

export function parseSlug(value: unknown, path?: utils.Path): string {
  if (isSlug(value)) {
    return value;
  }

  throw new utils.UnexpectedValueError('a slug', value, { path });
}

export const GraphQLSlug = new graphql.GraphQLScalarType({
  name: 'Slug',
  description:
    'Represents a slug: a string containing only lowercase letters, digits, hyphens and underscores. It cannot start or end with a hyphen or underscore, nor contain consecutive hyphens or underscores.',
  parseValue(value: unknown) {
    return parseSlug(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseSlug(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseSlug(value);
  },
});
