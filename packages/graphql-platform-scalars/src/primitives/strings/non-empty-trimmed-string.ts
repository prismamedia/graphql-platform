import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

function parseNonEmptyTrimmedString(value: unknown, path?: Path): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  throw new UnexpectedValueError('a non-empty trimmed string', value, { path });
}

export const GraphQLNonEmptyTrimmedString = new graphql.GraphQLScalarType({
  name: 'NonEmptyTrimmedString',
  description:
    'A string in which the leading and trailing whitespace characters are removed and cannot be empty afterwards.',
  parseValue(value: unknown) {
    return parseNonEmptyTrimmedString(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptyTrimmedString(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseNonEmptyTrimmedString(value, addPath(undefined, this.name));
  },
});
