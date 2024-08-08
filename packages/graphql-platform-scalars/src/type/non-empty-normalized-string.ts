import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const normalize = (value: string): string =>
  value
    .normalize()
    // Replace any sequence of whitespace and control characters with a single space
    .replace(/[\p{Separator}\p{Other}]*\s[\p{Separator}\p{Other}]*/gu, ' ')
    // Remove leading whitespaces, trailing whitespaces and control characters
    .replace(/^ | $|\p{Other}/gu, '');

export const isNonEmptyNormalizedString = (value: unknown): value is string =>
  typeof value === 'string' && normalize(value).length > 0;

export function parseNonEmptyNormalizedString(
  value: unknown,
  path?: utils.Path,
): string {
  if (typeof value === 'string') {
    const normalizedValue = normalize(value);
    if (normalizedValue.length > 0) {
      return normalizedValue;
    }
  }

  throw new utils.UnexpectedValueError('a non-empty normalized string', value, {
    path,
  });
}

export const GraphQLNonEmptyNormalizedString = new graphql.GraphQLScalarType({
  name: 'NonEmptyNormalizedString',
  description:
    'Represents a non-empty normalized string. Sequences of whitespace and control characters are replaced with a single space. Leading whitespaces, trailing whitespaces and control characters are removed.',
  parseValue(value: unknown) {
    return parseNonEmptyNormalizedString(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptyNormalizedString(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonEmptyNormalizedString(value);
  },
});
