import { isDeepStrictEqual } from 'node:util';
import { GetScalarInternalValue, Scalars, ScalarType } from './index.js';

export type ScalarComparator<TScalarType extends ScalarType> = (
  a: GetScalarInternalValue<TScalarType>,
  b: GetScalarInternalValue<TScalarType>,
) => boolean;

export const getScalarComparator = <TScalarType extends ScalarType>(
  type: TScalarType,
): ScalarComparator<TScalarType> =>
  (type === Scalars.DateTime || type === Scalars.Date
    ? (a: Date, b: Date) => a.getTime() === b.getTime()
    : type === Scalars.URL
    ? (a: URL, b: URL) => a.toString() === b.toString()
    : type === Scalars.DraftJS ||
      type === Scalars.JSONArray ||
      type === Scalars.JSONObject
    ? (a: any, b: any) => isDeepStrictEqual(a, b)
    : (a: any, b: any) => a === b) as any;
