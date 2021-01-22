import { isPlainObject as baseIsPlainObject } from 'lodash';

export type KeysOfUnion<T> = T extends any ? keyof T : never;

export type PlainObject = { [key: string]: any };

export function isPlainObject(
  maybePlainObject: any,
): maybePlainObject is PlainObject {
  return baseIsPlainObject(maybePlainObject);
}

/**
 * Given a plain object, keep only the non-"undefined" properties and returns the new object, or "undefined" if there is no "defined" property
 */
export const normalizeObject = (object: PlainObject): PlainObject | undefined =>
  Object.entries(object).reduce(
    (object: PlainObject | undefined, [key, value]) => {
      const normalizedValue = isPlainObject(value)
        ? normalizeObject(value)
        : value;

      return normalizedValue !== undefined
        ? { ...object, [key]: normalizedValue }
        : object;
    },
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
