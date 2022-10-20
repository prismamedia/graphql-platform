import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export function parseUnsignedFloat(value: unknown, path?: utils.Path): number {
  const parsedValue = graphql.GraphQLFloat.parseValue(value);
  if (Object.is(parsedValue, -0) || parsedValue < 0) {
    throw new utils.UnexpectedValueError('an unsigned float', value, { path });
  }

  return parsedValue;
}

export const GraphQLUnsignedFloat = new graphql.GraphQLScalarType({
  name: 'UnsignedFloat',
  description:
    'The `UnsignedFloat` scalar type represents unsigned double-precision fractional values.',
  specifiedByURL: 'https://en.wikipedia.org/wiki/IEEE_floating_point',
  parseValue(value: unknown) {
    return parseUnsignedFloat(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.FLOAT) {
      return parseUnsignedFloat(Number.parseFloat(ast.value));
    } else if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedFloat(Number.parseInt(ast.value, 10));
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseUnsignedFloat(value);
  },
});
