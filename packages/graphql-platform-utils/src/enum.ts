import assert from 'node:assert';
import type { PlainObject } from './plain-object.js';

export type EnumKey<TEnumerable extends PlainObject> = Extract<
  keyof TEnumerable,
  string
>;

export type EnumValue<TEnumerable extends PlainObject> = {
  [K in keyof TEnumerable]: TEnumerable[K] extends string | number
    ? TEnumerable[K]
    : never;
}[keyof TEnumerable];

export function getEnumKeys<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): EnumKey<TEnumerable>[] {
  const keys: EnumKey<TEnumerable>[] = [];

  for (const key of Object.keys(enumerable)) {
    if (Number.isNaN(Number.parseInt(key))) {
      keys.push(key as EnumKey<TEnumerable>);
    }
  }

  return keys;
}

export function getEnumKeySet<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): Set<EnumKey<TEnumerable>> {
  return new Set(getEnumKeys(enumerable));
}

export function getEnumValues<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): EnumValue<TEnumerable>[] {
  return getEnumKeys(enumerable).map((key) => enumerable[key]);
}

export function getEnumValueSet<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
): Set<EnumValue<TEnumerable>> {
  return new Set(getEnumValues(enumerable));
}

export function isEnumKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  maybeKey: unknown,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): maybeKey is EnumKey<TEnumerable> {
  return keySet.has(maybeKey as any);
}

export function isEnumValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  maybeValue: unknown,
  valueSet: ReadonlySet<EnumValue<TEnumerable>> = getEnumValueSet(enumerable),
): maybeValue is EnumValue<TEnumerable> {
  return valueSet.has(maybeValue as any);
}

export function ensureEnumKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  maybeKey: unknown,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): EnumKey<TEnumerable> {
  assert(
    isEnumKey(enumerable, maybeKey, keySet),
    `"${maybeKey}" is not among this enum's keys`,
  );

  return maybeKey;
}

export function ensureEnumValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  maybeValue: unknown,
  valueSet: ReadonlySet<EnumValue<TEnumerable>> = getEnumValueSet(enumerable),
): EnumValue<TEnumerable> {
  assert(
    isEnumValue(enumerable, maybeValue, valueSet),
    `"${maybeValue}" is not among this enum's values`,
  );

  return maybeValue;
}

export function getEnumKeysByValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): Map<EnumValue<TEnumerable>, EnumKey<TEnumerable>> {
  return new Map(Array.from(keySet, (key) => [enumerable[key], key]));
}

export function getEnumKeyByValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  value: EnumValue<TEnumerable>,
  keysByValue: ReadonlyMap<
    EnumValue<TEnumerable>,
    EnumKey<TEnumerable>
  > = getEnumKeysByValue(enumerable),
): EnumKey<TEnumerable> {
  const key = keysByValue.get(value);
  assert(key !== undefined, `"${value}" is not among this enum's values`);

  return key;
}

export function getEnumValuesByKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): Map<EnumKey<TEnumerable>, EnumValue<TEnumerable>> {
  return new Map(Array.from(keySet, (key) => [key, enumerable[key]]));
}

export function getEnumValueByKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  key: EnumKey<TEnumerable>,
  valuesByKey: ReadonlyMap<
    EnumKey<TEnumerable>,
    EnumValue<TEnumerable>
  > = getEnumValuesByKey(enumerable),
): EnumValue<TEnumerable> {
  const value = valuesByKey.get(key);
  assert(value !== undefined, `"${key}" is not among this enum's keys`);

  return value;
}

/**
 * Returns a set of utilities for working with the given enum
 */
export function createEnumUtils<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
) {
  const keys = getEnumKeys(enumerable);
  const keySet = new Set(keys);

  const values = getEnumValues(enumerable);
  const valueSet = new Set(values);

  const keysByValue = getEnumKeysByValue(enumerable, keySet);
  const valuesByKey = getEnumValuesByKey(enumerable, keySet);

  return {
    keys,
    values,
    isKey: (maybeKey: unknown): maybeKey is EnumKey<TEnumerable> =>
      isEnumKey(enumerable, maybeKey, keySet),
    ensureKey: (maybeKey: unknown): EnumKey<TEnumerable> =>
      ensureEnumKey(enumerable, maybeKey, keySet),
    isValue: (maybeValue: unknown): maybeValue is EnumValue<TEnumerable> =>
      isEnumValue(enumerable, maybeValue, valueSet),
    ensureValue: (maybeValue: unknown): EnumValue<TEnumerable> =>
      ensureEnumValue(enumerable, maybeValue, valueSet),
    getKeyByValue: (value: EnumValue<TEnumerable>): EnumKey<TEnumerable> =>
      getEnumKeyByValue(enumerable, value, keysByValue),
    getValueByKey: (key: EnumKey<TEnumerable>): EnumValue<TEnumerable> =>
      getEnumValueByKey(enumerable, key, valuesByKey),
  };
}
