import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export const GRAPHQL_MAX_UNSIGNED_INT = 2 * graphql.GRAPHQL_MAX_INT;

export function parseUnsignedInt(value: unknown, path?: Path): number {
  const parsedValue = graphql.GraphQLInt.parseValue(value);
  if (
    !Object.is(parsedValue, -0) &&
    parsedValue >= 0 &&
    parsedValue <= GRAPHQL_MAX_UNSIGNED_INT
  ) {
    return parsedValue;
  }

  throw new UnexpectedValueError('an unsigned 32-bit integer', value, { path });
}

export const GraphQLUnsignedInt = new graphql.GraphQLScalarType({
  name: 'UnsignedInt',
  description: `The \`UnsignedInt\` scalar type represents non-fractional unsigned whole numeric values, it can represent values between 0 and ${GRAPHQL_MAX_UNSIGNED_INT} (= 2^32 - 1).`,
  parseValue(value: unknown) {
    return parseUnsignedInt(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedInt(Number.parseInt(ast.value, 10), path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseUnsignedInt(value, addPath(undefined, this.name));
  },
});
