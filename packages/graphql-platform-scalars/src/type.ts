import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { ValueOf } from 'type-fest';
import { GraphQLBigInt } from './type/big-int.js';
import { GraphQLDateTime } from './type/date-time.js';
import { GraphQLDate } from './type/date.js';
import { GraphQLDraftJS } from './type/draft-js.js';
import { GraphQLEmailAddress } from './type/email-address.js';
import { jsonTypesByName } from './type/json.js';
import { GraphQLNonEmptyString } from './type/non-empty-string.js';
import { GraphQLNonEmptyTrimmedString } from './type/non-empty-trimmed-string.js';
import { GraphQLUnsignedBigInt } from './type/unsigned-bigint.js';
import { GraphQLUnsignedFloat } from './type/unsigned-float.js';
import { GraphQLUnsignedInt } from './type/unsigned-int.js';
import { GraphQLURL } from './type/url.js';
import { uuidTypesByName } from './type/uuid.js';

export * from './type/big-int.js';
export * from './type/date-time.js';
export * from './type/date.js';
export * from './type/draft-js.js';
export * from './type/email-address.js';
export * from './type/json.js';
export * from './type/non-empty-string.js';
export * from './type/non-empty-trimmed-string.js';
export * from './type/unsigned-bigint.js';
export * from './type/unsigned-float.js';
export * from './type/unsigned-int.js';
export * from './type/url.js';
export * from './type/uuid.js';

/**
 * @see https://graphql.org/graphql-js/type/#scalars
 */
export const basicTypesByName = {
  Boolean: graphql.GraphQLBoolean,
  Float: graphql.GraphQLFloat,
  ID: graphql.GraphQLID,
  Int: graphql.GraphQLInt,
  String: graphql.GraphQLString,
} satisfies Record<string, graphql.GraphQLScalarType>;

export const typesByName = Object.freeze({
  // Basic
  ...basicTypesByName,

  // GraphQL Platform
  BigInt: GraphQLBigInt,
  Date: GraphQLDate,
  DateTime: GraphQLDateTime,
  DraftJS: GraphQLDraftJS,
  EmailAddress: GraphQLEmailAddress,
  NonEmptyString: GraphQLNonEmptyString,
  NonEmptyTrimmedString: GraphQLNonEmptyTrimmedString,
  UnsignedBigInt: GraphQLUnsignedBigInt,
  UnsignedFloat: GraphQLUnsignedFloat,
  UnsignedInt: GraphQLUnsignedInt,
  URL: GraphQLURL,
  ...jsonTypesByName,
  ...uuidTypesByName,
} satisfies Record<string, graphql.GraphQLScalarType>);

type TypesByName = typeof typesByName;

export type TypeName = keyof TypesByName;
export const typeNames = Object.keys(typesByName);

export type Type = ValueOf<TypesByName>;
export const types = Object.values(typesByName);

export type GetInternalValueByType<TType extends Type> =
  TType extends graphql.GraphQLScalarType<infer TInternalValue, any>
    ? TInternalValue
    : never;

export type GetExternalValueByType<TType extends Type> =
  TType extends graphql.GraphQLScalarType<any, infer TExternalValue>
    ? TExternalValue
    : never;

export function getTypeByName(
  maybeTypeName: TypeName,
  path?: utils.Path,
): Type {
  const scalarType = typesByName[maybeTypeName];
  if (!scalarType) {
    throw new utils.UnexpectedValueError(
      `a scalar type name among "${typeNames.join(', ')}"`,
      maybeTypeName,
      { path },
    );
  }

  return scalarType;
}

export function assertType(
  maybeType: unknown,
  path?: utils.Path,
): asserts maybeType is Type {
  if (!types.includes(maybeType as any)) {
    throw new utils.UnexpectedValueError(
      `a scalar type among "${typeNames.join(', ')}"`,
      maybeType,
      { path },
    );
  }
}

export function ensureType(maybeType: unknown, path: utils.Path): Type {
  assertType(maybeType, path);

  return maybeType;
}
