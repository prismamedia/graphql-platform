import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { parseBigInt } from './big-int.js';

export function parseUnsignedBigInt(value: unknown, path?: utils.Path): bigint {
  const parsedValue = parseBigInt(value, path);
  if (parsedValue < 0n) {
    throw new utils.UnexpectedValueError('an unsigned BigInt', value, { path });
  }

  // It is impossible to differentiate -0n from 0n
  return parsedValue === 0n ? 0n : parsedValue;
}

export const GraphQLUnsignedBigInt = new graphql.GraphQLScalarType({
  name: 'UnsignedBigInt',
  description:
    'The `UnsignedBigInt` scalar type represents non-fractional unsigned whole numeric values.',
  specifiedByURL:
    'https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-bigint-objects',
  parseValue(value: unknown) {
    return parseUnsignedBigInt(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedBigInt(parseInt(ast.value, 10));
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseUnsignedBigInt(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseUnsignedBigInt(value).toString();
  },
});
