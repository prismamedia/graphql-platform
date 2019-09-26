import { GraphQLBigInt } from 'graphql-scalars';
import { TypedGraphQLScalarType } from '../types';

export const bigintScalarTypes = Object.freeze([
  GraphQLBigInt as TypedGraphQLScalarType<'BigInt', bigint, string>,
]);
