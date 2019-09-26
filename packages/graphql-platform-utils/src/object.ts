import { isPlainObject as baseIsPlainObject } from 'lodash';
import { ValueOf } from 'type-fest';

export type KeysOfUnion<T> = T extends any ? keyof T : never;

export type PlainObject = { [key: string]: any };

export function isPlainObject(
  maybePlainObject: any,
): maybePlainObject is PlainObject {
  return baseIsPlainObject(maybePlainObject);
}

export function fromObjectEntries<TEntry extends [PropertyKey, any]>(
  entries: Iterable<TEntry>,
) {
  return Object.fromEntries(entries) as {
    [TKey in TEntry[0]]: Extract<TEntry, [TKey, any]>[1];
  };
}

export function getObjectEntries<TObject extends Record<any, any>>(
  object: TObject,
) {
  return Object.entries(object) as ValueOf<
    {
      [TKey in keyof TObject]: [TKey, TObject[TKey]];
    }
  >[];
}

export function getObjectKeys<K extends PropertyKey>(object: Record<K, any>) {
  return Object.keys(object) as K[];
}

export function getObjectValues<V>(object: Record<any, V>) {
  return Object.values(object) as V[];
}

export function mapObject<K extends PropertyKey, V0, V1>(
  object: Record<K, V0>,
  mapper: (value: V0, key: K) => V1,
) {
  return fromObjectEntries(
    getObjectEntries(object).map(([key, value]): [K, V1] => [
      key,
      mapper(value, key),
    ]),
  );
}

/**
 * Given a plain object, keep only the non-"undefined" properties and returns the new object, or "undefined" if there is no "defined" property
 */
export const getNormalizedObject = (
  object: Partial<PlainObject>,
): PlainObject | undefined =>
  Object.entries(object).reduce(
    (object: PlainObject | undefined, [key, value]) =>
      value !== undefined ? { ...object, [key]: value } : object,
    undefined,
  );

export interface VisibilityAware {
  readonly public: boolean;
}

export type Public<T extends VisibilityAware> = T & { public: true };

export const isPublic = <T extends VisibilityAware>(
  element: T,
): element is Public<T> => element.public;

export const isPublicEntry = <T extends VisibilityAware>(
  entry: [string, T],
): entry is [string, Public<T>] => isPublic(entry[1]);

export interface NameAware {
  readonly name: string;
}
