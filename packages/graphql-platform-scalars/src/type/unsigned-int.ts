import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export const GRAPHQL_MAX_UNSIGNED_INT = 2 * graphql.GRAPHQL_MAX_INT;

export function parseUnsignedInt(value: unknown, path?: utils.Path): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    Object.is(value, -0) ||
    value < 0 ||
    value > GRAPHQL_MAX_UNSIGNED_INT
  ) {
    throw new utils.UnexpectedValueError('an unsigned 32-bit integer', value, {
      path,
    });
  }

  return value;
}

export const GraphQLUnsignedInt = new graphql.GraphQLScalarType({
  name: 'UnsignedInt',
  description: `The \`UnsignedInt\` scalar type represents non-fractional unsigned whole numeric values, it can represent values between 0 and ${GRAPHQL_MAX_UNSIGNED_INT} (= 2^32 - 1).`,
  parseValue(value: unknown) {
    return parseUnsignedInt(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedInt(Number.parseInt(ast.value, 10));
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseUnsignedInt(value);
  },
});
