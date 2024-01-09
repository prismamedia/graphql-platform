import { describe, expect, it } from '@jest/globals';
import { createEnumUtils, type EnumKey, type EnumValue } from './enum.js';

enum MyNumericEnum {
  ONE,
  TWO,
  THREE,
}

type MyNumericEnumKey = EnumKey<typeof MyNumericEnum>;
type MyNumericEnumValue = EnumValue<typeof MyNumericEnum>;

enum MyStringEnum {
  ONE = 'one',
  TWO = 'two',
  THREE = 'three',
}

type MyStringEnumKey = EnumKey<typeof MyStringEnum>;
type MyStringEnumValue = EnumValue<typeof MyStringEnum>;

enum MyMixedEnum {
  ONE = 0,
  TWO = 'two',
  THREE = 2,
}

type MyMixedEnumKey = EnumKey<typeof MyMixedEnum>;
type MyMixedEnumValue = EnumValue<typeof MyMixedEnum>;

describe('Enum', () => {
  describe.each([
    ['numeric', MyNumericEnum, { ONE: 0, TWO: 1, THREE: 2 }],
    ['string', MyStringEnum, { ONE: 'one', TWO: 'two', THREE: 'three' }],
    ['mixed', MyMixedEnum, { ONE: 0, TWO: 'two', THREE: 2 }],
  ])('works for "%s"', (_label, enumerable, object) => {
    const {
      keys,
      values,
      isKey,
      ensureKey,
      isValue,
      ensureValue,
      getKeyByValue,
      getValueByKey,
    } = createEnumUtils(enumerable);

    it('gets keys', () => {
      expect(keys).toEqual(Object.keys(object));

      Object.keys(object).forEach((key) => {
        expect(isKey(key)).toBe(true);
        expect(ensureKey(key)).toBe(key);
      });

      ['FOUR', 0].forEach((key) => {
        expect(isKey(key)).toBe(false);
        expect(() => ensureKey(key)).toThrow();
      });
    });

    it('gets values', () => {
      expect(values).toEqual(Object.values(object));

      Object.values(object).forEach((value) => {
        expect(isValue(value)).toBe(true);
        expect(ensureValue(value)).toBe(value);
      });

      [-1, '1', 'ONE'].forEach((value) => {
        expect(isValue(value)).toBe(false);
        expect(() => ensureValue(value)).toThrow();
      });
    });

    it('gets key by value', () => {
      Object.entries(object).map(([key, value]) =>
        expect(getKeyByValue(ensureValue(value))).toBe(key),
      );
    });

    it('gets value by key', () => {
      Object.entries(object).map(([key, value]) =>
        expect(getValueByKey(ensureKey(key))).toBe(value),
      );
    });
  });
});
