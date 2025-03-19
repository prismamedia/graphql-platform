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
  key: unknown,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): key is EnumKey<TEnumerable> {
  return keySet.has(key as any);
}

export function assertEnumKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  key: unknown,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): asserts key is EnumKey<TEnumerable> {
  assert(
    isEnumKey(enumerable, key, keySet),
    `"${key}" is not among this enum's keys`,
  );
}

export function ensureEnumKey<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  key: unknown,
  keySet: ReadonlySet<EnumKey<TEnumerable>> = getEnumKeySet(enumerable),
): EnumKey<TEnumerable> {
  assertEnumKey(enumerable, key, keySet);

  return key;
}

export function isEnumValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  value: unknown,
  valueSet: ReadonlySet<EnumValue<TEnumerable>> = getEnumValueSet(enumerable),
): value is EnumValue<TEnumerable> {
  return valueSet.has(value as any);
}

export function assertEnumValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  value: unknown,
  valueSet: ReadonlySet<EnumValue<TEnumerable>> = getEnumValueSet(enumerable),
): asserts value is EnumValue<TEnumerable> {
  assert(
    isEnumValue(enumerable, value, valueSet),
    `"${value}" is not among this enum's values`,
  );
}

export function ensureEnumValue<TEnumerable extends PlainObject>(
  enumerable: TEnumerable,
  value: unknown,
  valueSet: ReadonlySet<EnumValue<TEnumerable>> = getEnumValueSet(enumerable),
): EnumValue<TEnumerable> {
  assertEnumValue(enumerable, value, valueSet);

  return value;
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
    isKey: (key: unknown): key is EnumKey<TEnumerable> =>
      isEnumKey(enumerable, key, keySet),
    assertKey: (key: unknown): asserts key is EnumKey<TEnumerable> =>
      assertEnumKey(enumerable, key, keySet),
    ensureKey: (key: unknown): EnumKey<TEnumerable> =>
      ensureEnumKey(enumerable, key, keySet),
    isValue: (value: unknown): value is EnumValue<TEnumerable> =>
      isEnumValue(enumerable, value, valueSet),
    assertValue: (value: unknown): asserts value is EnumValue<TEnumerable> =>
      assertEnumValue(enumerable, value, valueSet),
    ensureValue: (value: unknown): EnumValue<TEnumerable> =>
      ensureEnumValue(enumerable, value, valueSet),
    getKeyByValue: (value: EnumValue<TEnumerable>): EnumKey<TEnumerable> =>
      getEnumKeyByValue(enumerable, value, keysByValue),
    getValueByKey: (key: EnumKey<TEnumerable>): EnumValue<TEnumerable> =>
      getEnumValueByKey(enumerable, key, valuesByKey),
  };
}
