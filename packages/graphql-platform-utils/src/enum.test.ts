import { describe, expect, it } from '@jest/globals';
import { getEnumKeys, getEnumValues } from './enum.js';

enum MyNumericEnum {
  ONE,
  TWO,
  THREE,
}

enum MyStringEnum {
  ONE = 'one',
  TWO = 'two',
  THREE = 'three',
}

enum MyMixedEnum {
  ONE = 0,
  TWO = 'two',
  THREE = 2,
}

describe('Enum', () => {
  it('works with numeric enum', () => {
    expect(getEnumKeys(MyNumericEnum)).toEqual(['ONE', 'TWO', 'THREE']);
    expect(getEnumValues(MyNumericEnum)).toEqual([0, 1, 2]);
  });

  it('works with string enum', () => {
    expect(getEnumKeys(MyStringEnum)).toEqual(['ONE', 'TWO', 'THREE']);
    expect(getEnumValues(MyStringEnum)).toEqual(['one', 'two', 'three']);
  });

  it('works with mixed enum', () => {
    expect(getEnumKeys(MyMixedEnum)).toEqual(['ONE', 'TWO', 'THREE']);
    expect(getEnumValues(MyMixedEnum)).toEqual([0, 'two', 2]);
  });
});
