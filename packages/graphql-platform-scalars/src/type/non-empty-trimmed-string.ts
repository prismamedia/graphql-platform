import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export function parseNonEmptyTrimmedString(
  value: unknown,
  path?: utils.Path,
): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      return trimmedValue;
    }
  }

  throw new utils.UnexpectedValueError('a non-empty trimmed string', value, {
    path,
  });
}

export const GraphQLNonEmptyTrimmedString = new graphql.GraphQLScalarType({
  name: 'NonEmptyTrimmedString',
  description:
    'A string in which the leading and trailing whitespace characters are removed and cannot be empty afterwards.',
  parseValue(value: unknown) {
    return parseNonEmptyTrimmedString(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptyTrimmedString(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonEmptyTrimmedString(value);
  },
});
