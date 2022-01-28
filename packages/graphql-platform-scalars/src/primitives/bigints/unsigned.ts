import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { parseBigInt } from './signed.js';

export function parseUnsignedBigInt(value: unknown, path?: Path): BigInt {
  const parsedValue = parseBigInt(value, path);
  if (parsedValue >= 0n) {
    // It is impossible to differentiate -0n from 0n
    return parsedValue === 0n ? 0n : parsedValue;
  }

  throw new UnexpectedValueError('an unsigned BigInt', value, { path });
}

export const GraphQLUnsignedBigInt = new graphql.GraphQLScalarType({
  name: 'UnsignedBigInt',
  description:
    'The `UnsignedBigInt` scalar type represents non-fractional unsigned whole numeric values.',
  specifiedByURL:
    'https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-bigint-objects',
  parseValue(value: unknown) {
    return parseUnsignedBigInt(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.INT) {
      return parseUnsignedBigInt(parseInt(ast.value, 10), path);
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseUnsignedBigInt(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseUnsignedBigInt(value, addPath(undefined, this.name)).toString();
  },
});
