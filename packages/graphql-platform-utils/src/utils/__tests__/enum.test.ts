import {
  assertEnumKey,
  assertEnumKeyFromValue,
  assertEnumValue,
  getEnumKeyFromValue,
  getEnumKeys,
  getEnumValues,
  isEnumKey,
  isEnumValue,
} from '../enum';

enum ANumericEnum {
  Left,
  Right,
  Up,
  Down,
}

enum AStringEnum {
  Left = 'LEFT',
  Right = 'RIGHT',
  Up = 'UP',
  Down = 'DOWN',
}

describe('enum', () => {
  it('gets the keys', () => {
    expect(getEnumKeys(ANumericEnum)).toEqual(['Left', 'Right', 'Up', 'Down']);
    expect(getEnumKeys(AStringEnum)).toEqual(['Left', 'Right', 'Up', 'Down']);
  });

  it('gets the values', () => {
    expect(getEnumValues(ANumericEnum)).toEqual([0, 1, 2, 3]);
    expect(getEnumValues(AStringEnum)).toEqual(['LEFT', 'RIGHT', 'UP', 'DOWN']);
  });

  it('gets the key from a value', () => {
    expect(getEnumKeyFromValue(ANumericEnum, 5 as any)).toBeUndefined();
    expect(getEnumKeyFromValue(ANumericEnum, ANumericEnum.Up)).toEqual('Up');
    expect(assertEnumKeyFromValue(ANumericEnum, ANumericEnum.Up)).toEqual('Up');

    expect(getEnumKeyFromValue(AStringEnum, 'OTHER' as any)).toBeUndefined();
    expect(getEnumKeyFromValue(AStringEnum, AStringEnum.Up)).toEqual('Up');
    expect(assertEnumKeyFromValue(AStringEnum, AStringEnum.Up)).toEqual('Up');
  });

  it('is the key from the enum', () => {
    expect(isEnumKey(ANumericEnum, 'Other' as any)).toBeFalsy();
    expect(isEnumKey(ANumericEnum, 'Up')).toBeTruthy();

    expect(isEnumKey(AStringEnum, 'Other' as any)).toBeFalsy();
    expect(isEnumKey(AStringEnum, 'Up')).toBeTruthy();
  });

  it('assert the key is from the enum', () => {
    expect(() => assertEnumKey(ANumericEnum, 'Other' as any)).toThrowError(
      'The key "Other" does not belong to this enum, choose among: Left, Right, Up, Down',
    );
    expect(assertEnumKey(ANumericEnum, 'Up')).toEqual('Up');

    expect(() => assertEnumKey(AStringEnum, 'Other' as any)).toThrowError(
      'The key "Other" does not belong to this enum, choose among: Left, Right, Up, Down',
    );
    expect(assertEnumKey(AStringEnum, 'Up')).toEqual('Up');
  });

  it('is the value from the enum', () => {
    expect(isEnumValue(ANumericEnum, 5 as any)).toBeFalsy();
    expect(isEnumValue(ANumericEnum, ANumericEnum.Up)).toBeTruthy();

    expect(isEnumValue(AStringEnum, 'OTHER' as any)).toBeFalsy();
    expect(isEnumValue(AStringEnum, AStringEnum.Up)).toBeTruthy();
  });

  it('assert the value is from the enum', () => {
    expect(() => assertEnumValue(ANumericEnum, 5 as any)).toThrowError(
      'The value "5" does not belong to this enum, choose among: 0, 1, 2, 3',
    );
    expect(assertEnumValue(ANumericEnum, ANumericEnum.Up)).toEqual(2);

    expect(() => assertEnumValue(AStringEnum, 'OTHER' as any)).toThrowError(
      'The value "OTHER" does not belong to this enum, choose among: LEFT, RIGHT, UP, DOWN',
    );
    expect(assertEnumValue(AStringEnum, AStringEnum.Up)).toEqual('UP');
  });
});
