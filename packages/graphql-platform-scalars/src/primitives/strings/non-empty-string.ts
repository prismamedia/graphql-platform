import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

function parseNonEmptyString(value: unknown, path?: Path): string {
  if (typeof value === 'string' && value) {
    return value;
  }

  throw new UnexpectedValueError('a non-empty string', value, { path });
}

export const GraphQLNonEmptyString = new graphql.GraphQLScalarType({
  name: 'NonEmptyString',
  description: 'A non-empty string.',
  parseValue(value: unknown) {
    return parseNonEmptyString(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.STRING) {
      return parseNonEmptyString(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseNonEmptyString(value, addPath(undefined, this.name));
  },
});
