import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

export function parseBigInt(value: unknown, path?: utils.Path): bigint {
  if (typeof value === 'bigint') {
    return value;
  } else if (typeof value === 'number') {
    const coercedValue = BigInt(value);
    if (Number(coercedValue) !== value) {
      throw new utils.UnexpectedValueError('a BigInt', value, { path });
    }

    return coercedValue;
  } else if (typeof value === 'string') {
    const coercedValue = BigInt(value);
    if (String(coercedValue) !== value) {
      throw new utils.UnexpectedValueError('a BigInt', value, { path });
    }

    return coercedValue;
  }

  throw new utils.UnexpectedValueError('a BigInt', value, { path });
}

export const GraphQLBigInt = new graphql.GraphQLScalarType({
  name: 'BigInt',
  description:
    'The `BigInt` scalar type represents non-fractional signed whole numeric values.',
  specifiedByURL:
    'https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-bigint-objects',
  parseValue(value: unknown) {
    return parseBigInt(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.INT) {
      return parseBigInt(parseInt(ast.value, 10));
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseBigInt(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseBigInt(value).toString();
  },
});
