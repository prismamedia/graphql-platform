import type { PlainObject } from './plain-object.js';

export function getEnumKeys<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): Extract<keyof TEnumerable, string>[] {
  const keys: (keyof TEnumerable)[] = [];
  for (const key of Object.keys(enumerable)) {
    if (Number.isNaN(Number.parseInt(key))) {
      keys.push(key);
    }
  }

  return keys as any;
}

export function getEnumValues<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): any[] {
  return getEnumKeys(enumerable).map((key) => enumerable[key]);
}
