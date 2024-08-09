import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import {
  isNonEmptyNormalizedString,
  parseNonEmptyNormalizedString,
} from './non-empty-normalized-string.js';

const forbiddenElementsRegExp = new RegExp(
  `(${[
    // Comment
    '<!--.*?-->',
    // Tag
    '<[^>]*>',
  ].join('|')})`,
  'g',
);

export const isNonEmptySanitizedString = (value: unknown): value is string =>
  typeof value === 'string' &&
  !forbiddenElementsRegExp.test(value) &&
  isNonEmptyNormalizedString(value);

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
  }

  return parseNonEmptyNormalizedString(value, path);
}

export const GraphQLNonEmptySanitizedString = new graphql.GraphQLScalarType({
  name: 'NonEmptySanitizedString',
  description:
    'Represents a non-empty sanitized string. Cannot contain HTML. Sequences of whitespaces and control characters are replaced with a single space. Leading whitespaces, trailing whitespaces and control characters are removed.',
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
