import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export function parseUnsignedFloat(value: unknown, path?: Path): number {
  const parsedValue = graphql.GraphQLFloat.parseValue(value);
  if (!Object.is(parsedValue, -0) && parsedValue >= 0) {
    return parsedValue;
  }

  throw new UnexpectedValueError('an unsigned float', value, { path });
}

export const GraphQLUnsignedFloat = new graphql.GraphQLScalarType({
  name: 'UnsignedFloat',
  description:
    'The `UnsignedFloat` scalar type represents unsigned double-precision fractional values.',
  specifiedByURL: 'https://en.wikipedia.org/wiki/IEEE_floating_point',
  parseValue(value: unknown) {
    return parseUnsignedFloat(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.FLOAT) {
      return parseUnsignedFloat(Number.parseFloat(ast.value), path);
    } else if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedFloat(Number.parseInt(ast.value, 10), path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseUnsignedFloat(value, addPath(undefined, this.name));
  },
});
