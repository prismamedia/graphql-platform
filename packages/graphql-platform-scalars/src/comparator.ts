import { isDeepStrictEqual } from 'node:util';
import {
  GetInternalValueByType,
  GraphQLDate,
  GraphQLDateTime,
  GraphQLDraftJS,
  GraphQLJSONArray,
  GraphQLJSONObject,
  GraphQLURL,
  Type,
} from './type.js';

export type Comparator<TScalarType extends Type> = (
  a: GetInternalValueByType<TScalarType>,
  b: GetInternalValueByType<TScalarType>,
) => boolean;

export const getComparatorByType = <TType extends Type>(
  type: TType,
): Comparator<TType> =>
  (type === GraphQLDateTime || type === GraphQLDate
    ? (a: Date, b: Date) => a.getTime() === b.getTime()
    : type === GraphQLURL
    ? (a: URL, b: URL) => a.toString() === b.toString()
    : type === GraphQLDraftJS ||
      type === GraphQLJSONArray ||
      type === GraphQLJSONObject
    ? (a: any, b: any) => isDeepStrictEqual(a, b)
    : (a: any, b: any) => a === b) as any;
