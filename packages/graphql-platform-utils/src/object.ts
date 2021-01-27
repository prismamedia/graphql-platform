import { isPlainObject as baseIsPlainObject } from 'lodash';
import { ValueOf } from 'type-fest';
import { UnexpectedValueError } from './errors';
import { Path } from './path';

export type PlainObject = { [key: string]: any };

export function isPlainObject(
  maybePlainObject: unknown,
): maybePlainObject is PlainObject {
  return baseIsPlainObject(maybePlainObject);
}

export function isNonEmptyPlainObject(
  maybePlainObject: unknown,
): maybePlainObject is PlainObject {
  return (
    isPlainObject(maybePlainObject) && Object.keys(maybePlainObject).length > 0
  );
}

export function isNonEmptyArray(maybeArray: unknown): maybeArray is any[] {
  return Array.isArray(maybeArray) && maybeArray.length > 0;
}

export function assertPlainObject(
  maybePlainObject: unknown,
  path?: Path,
  expectation: string = 'a plain object',
): asserts maybePlainObject is PlainObject {
  if (!isPlainObject(maybePlainObject)) {
    throw new UnexpectedValueError(maybePlainObject, expectation, path);
  }
}

export function assertArray(
  maybeArray: unknown,
  path?: Path,
  expectation: string = 'an array',
): asserts maybeArray is any[] {
  if (!Array.isArray(maybeArray)) {
    throw new UnexpectedValueError(maybeArray, expectation, path);
  }
}

/**
 * Given a plain object, keep only the non-"undefined" properties and returns the new object, or "undefined" if there is no "defined" property
 */
export const normalizeObject = (
  object: PlainObject | undefined,
): PlainObject | undefined =>
  object !== undefined
    ? Object.entries(object).reduce(
        (object: PlainObject | undefined, [key, value]) => {
          const normalizedValue = isPlainObject(value)
            ? normalizeObject(value)
            : value;

          return normalizedValue !== undefined
            ? Object.assign(object ?? Object.create(null), {
                [key]: normalizedValue,
              })
            : object;
        },
        undefined,
      )
    : undefined;

export const getObjectKeys = <T extends PlainObject>(object: T): (keyof T)[] =>
  Object.keys(object);

export const getObjectValues = <T extends PlainObject>(
  object: T,
): ValueOf<T>[] => Object.values<any>(object);

/**
 * Same as the native "Object.fromEntries" but remove undefined entries and entries with undefined value
 */
export function fromObjectEntries<TKey extends string, TValue>(
  entries: Iterable<[TKey, TValue | undefined] | undefined>,
): Record<TKey, TValue> {
  return Object.fromEntries(
    [...entries].filter(
      (entry): entry is [TKey, TValue] =>
        entry !== undefined && entry[1] !== undefined,
    ),
  ) as any;
}

export function mapObjectValues<
  TOriginalValue,
  TMappedValue,
  TKey extends string = string,
>(
  object: Record<TKey, TOriginalValue>,
  mapper: (value: TOriginalValue, key: TKey) => TMappedValue | undefined,
): Record<TKey, TMappedValue> {
  return fromObjectEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      mapper(value as any, key as any),
    ]),
  ) as any;
}
