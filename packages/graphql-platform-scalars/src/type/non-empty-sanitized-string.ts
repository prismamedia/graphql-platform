import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const forbiddenElementsRegExp = new RegExp(
  `(${[
    // Comment
    '<!--.*?-->',
    // Tag
    '<[^>]*>',
  ].join('|')})`,
  'g',
);

/**
 *
 * @see https://www.unicode.org/reports/tr44/#General_Category_Values
 */
export const normalizeString = (value: string): string =>
  value
    .normalize()
    // Replace sequences of whitespaces and control characters with a single space
    .replace(/[\p{Separator}\p{Other}]*\s[\p{Separator}\p{Other}]*/gu, ' ')
    // Remove leading and trailing whitespaces & control characters and control characters
    .replace(
      /^[\p{Separator}\p{Other}]+|[\p{Separator}\p{Other}]+$|\p{Other}/gu,
      '',
    );

export const isNonEmptySanitizedString = (value: unknown): value is string =>
  typeof value === 'string' &&
  !forbiddenElementsRegExp.test(value) &&
  normalizeString(value).length > 0;

export function parseNonEmptySanitizedString(
  value: unknown,
  path?: utils.Path,
): string {
  if (typeof value === 'string') {
    const forbiddenElements = value.match(forbiddenElementsRegExp);
    if (forbiddenElements?.length) {
      throw forbiddenElements.length === 1
        ? new utils.UnexpectedValueError(
            'not to contain forbidden element',
            forbiddenElements[0],
            { path },
          )
        : new utils.AggregateGraphError(
            forbiddenElements.map(
              (forbiddenElement) =>
                new utils.UnexpectedValueError(
                  'not to contain forbidden element',
                  forbiddenElement,
                  { path },
                ),
            ),
            { message: 'not to contain forbidden elements', path },
          );
    }

    const normalizedValue = normalizeString(value);
    if (normalizedValue.length > 0) {
      return normalizedValue;
    }
  }

  throw new utils.UnexpectedValueError('a non-empty sanitized string', value, {
    path,
  });
}

export const GraphQLNonEmptySanitizedString = new graphql.GraphQLScalarType({
  name: 'NonEmptySanitizedString',
  description:
    'A string in which the sequences of whitespaces and control characters are replaced with a single space - the leading whitespaces, trailing whitespaces and control characters are removed. It cannot contain HTML.',
  parseValue(value: unknown) {
    return parseNonEmptySanitizedString(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptySanitizedString(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonEmptySanitizedString(value);
  },
});
