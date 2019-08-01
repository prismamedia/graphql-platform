import { POJO } from '../types/pojo';
import { ValueOf } from '../types/value-of';

export function getEnumKeys<TEnumerable extends POJO>(enumerable: TEnumerable): (keyof TEnumerable)[] {
  const keys: (keyof TEnumerable)[] = [];
  for (const key of Object.keys(enumerable)) {
    if (Number.isNaN(Number.parseInt(key))) {
      keys.push(key);
    }
  }

  return keys;
}

export function getEnumValues<TEnumerable extends POJO>(enumerable: TEnumerable): ValueOf<TEnumerable>[] {
  return getEnumKeys(enumerable).map(key => enumerable[key]);
}

export function getEnumKeyFromValue<TEnumerable extends POJO>(
  enumerable: TEnumerable,
  value: ValueOf<TEnumerable>,
): (keyof TEnumerable) | undefined {
  if (typeof value === 'number') {
    // For numeric enums
    return enumerable[value];
  } else {
    // For string enums
    for (const [k, v] of Object.entries(enumerable)) {
      if (value === v) {
        return k;
      }
    }
  }

  return undefined;
}

export function isEnumKey<TEnumerable extends POJO>(
  enumerable: TEnumerable,
  key: keyof TEnumerable,
): key is keyof TEnumerable {
  return getEnumKeys(enumerable).includes(key);
}

export function assertEnumKey<TEnumerable extends POJO>(
  enumerable: TEnumerable,
  key: keyof TEnumerable,
): keyof TEnumerable {
  if (!isEnumKey(enumerable, key)) {
    throw new Error(
      `The value "${key}" does not belong to this enum, choose among: ${getEnumKeys(enumerable).join(', ')}`,
    );
  }

  return key;
}

export function isEnumValue<TEnumerable extends POJO>(
  enumerable: TEnumerable,
  value: ValueOf<TEnumerable>,
): value is ValueOf<TEnumerable> {
  return getEnumValues(enumerable).includes(value);
}

export function assertEnumValue<TEnumerable extends POJO>(
  enumerable: TEnumerable,
  value: ValueOf<TEnumerable>,
): ValueOf<TEnumerable> {
  if (!isEnumValue(enumerable, value)) {
    throw new Error(
      `The value "${value}" does not belong to this enum, choose among: ${getEnumValues(enumerable).join(', ')}`,
    );
  }

  return value;
}
