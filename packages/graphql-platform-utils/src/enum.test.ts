import assert from 'node:assert';
import { describe, it } from 'node:test';
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
  const cases = [
    ['numeric', MyNumericEnum, { ONE: 0, TWO: 1, THREE: 2 }],
    ['string', MyStringEnum, { ONE: 'one', TWO: 'two', THREE: 'three' }],
    ['mixed', MyMixedEnum, { ONE: 0, TWO: 'two', THREE: 2 }],
  ] as const;

  cases.forEach(([label, enumerable, object]) =>
    describe(`works for "${label}"`, () => {
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
        assert.deepStrictEqual(keys, Object.keys(object));

        Object.keys(object).forEach((key) => {
          assert.strictEqual(isKey(key), true);
          assert.strictEqual(ensureKey(key), key);
        });

        ['FOUR', 0].forEach((key) => {
          assert.strictEqual(isKey(key), false);
          assert.throws(() => ensureKey(key));
        });
      });

      it('gets values', () => {
        assert.deepStrictEqual(values, Object.values(object));

        Object.values(object).forEach((value) => {
          assert.strictEqual(isValue(value), true);
          assert.strictEqual(ensureValue(value), value);
        });

        [-1, '1', 'ONE'].forEach((value) => {
          assert.strictEqual(isValue(value), false);
          assert.throws(() => ensureValue(value));
        });
      });

      it('gets key by value', () => {
        Object.entries(object).map(([key, value]) =>
          assert.strictEqual(getKeyByValue(ensureValue(value)), key),
        );
      });

      it('gets value by key', () => {
        Object.entries(object).map(([key, value]) =>
          assert.strictEqual(getValueByKey(ensureKey(key)), value),
        );
      });
    }),
  );
});
