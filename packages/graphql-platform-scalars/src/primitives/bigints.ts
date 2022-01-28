import { GraphQLBigInt } from './bigints/signed.js';
import { GraphQLUnsignedBigInt } from './bigints/unsigned.js';

export * from './bigints/signed.js';
export * from './bigints/unsigned.js';

export const bigintScalarTypesByName = {
  BigInt: GraphQLBigInt,
  UnsignedBigInt: GraphQLUnsignedBigInt,
} as const;
