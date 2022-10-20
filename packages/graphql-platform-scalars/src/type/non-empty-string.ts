import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

function parseNonEmptyString(value: unknown, path?: utils.Path): string {
  if (typeof value === 'string' && value.length) {
    return value;
  }

  throw new utils.UnexpectedValueError('a non-empty string', value, { path });
}

export const GraphQLNonEmptyString = new graphql.GraphQLScalarType({
  name: 'NonEmptyString',
  description: 'A non-empty string.',
  parseValue(value: unknown) {
    return parseNonEmptyString(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptyString(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonEmptyString(value);
  },
});
