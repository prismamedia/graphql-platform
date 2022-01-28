import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export function parseBigInt(value: unknown, path?: Path): BigInt {
  if (typeof value === 'bigint') {
    return value;
  } else if (typeof value === 'number') {
    const coercedValue = BigInt(value);
    if (Number(coercedValue) === value) {
      return coercedValue;
    }
  } else if (typeof value === 'string') {
    const coercedValue = BigInt(value);
    if (String(coercedValue) === value) {
      return coercedValue;
    }
  }

  throw new UnexpectedValueError('a BigInt', value, { path });
}

export const GraphQLBigInt = new graphql.GraphQLScalarType({
  name: 'BigInt',
  description:
    'The `BigInt` scalar type represents non-fractional signed whole numeric values.',
  specifiedByURL:
    'https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-bigint-objects',
  parseValue(value: unknown) {
    return parseBigInt(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.INT) {
      return parseBigInt(parseInt(ast.value, 10), path);
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseBigInt(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseBigInt(value, addPath(undefined, this.name)).toString();
  },
});
