import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export const isNonEmptyTrimmedString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function parseNonEmptyTrimmedString(
  value: unknown,
  path?: utils.Path,
): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue.length > 0) {
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
    'Represents a non-empty trimmed string. Leading and trailing whitespaces are removed.',
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
