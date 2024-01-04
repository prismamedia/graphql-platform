import { isDeepStrictEqual } from 'node:util';
import {
  GraphQLDate,
  GraphQLDateTime,
  GraphQLDraftJS,
  GraphQLJSONArray,
  GraphQLJSONObject,
  GraphQLJSONValue,
  GraphQLURL,
  type GetInternalValueByType,
  type Type,
} from './type.js';

export type Comparator<TScalarType extends Type> = (
  a: GetInternalValueByType<TScalarType>,
  b: GetInternalValueByType<TScalarType>,
) => boolean;

/**
 * @see https://tc39.es/ecma262/#sec-isstrictlyequal
 */
export const getNonStrictEqualityComparatorByType = <TType extends Type>(
  type: TType,
): Comparator<TType> | undefined =>
  (type === GraphQLDateTime || type === GraphQLDate
    ? (a: Date, b: Date) => a.getTime() === b.getTime()
    : type === GraphQLURL
    ? (a: URL, b: URL) => a.toString() === b.toString()
    : type === GraphQLDraftJS ||
      type === GraphQLJSONArray ||
      type === GraphQLJSONObject ||
      type === GraphQLJSONValue
    ? (a: any, b: any) => isDeepStrictEqual(a, b)
    : undefined) as any;

export const getComparatorByType = <TType extends Type>(
  type: TType,
): Comparator<TType> =>
  getNonStrictEqualityComparatorByType(type) ?? ((a: any, b: any) => a === b);
