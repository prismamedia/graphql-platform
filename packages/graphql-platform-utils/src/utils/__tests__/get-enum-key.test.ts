import { getEnumKey } from '../get-enum-key';

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

describe('getEnumKey', () => {
  it('gets the key from a numeric enum', () => {
    expect(getEnumKey(5, ANumericEnum)).toBeUndefined();
    expect(getEnumKey(ANumericEnum.Up, ANumericEnum)).toEqual('Up');
  });

  it('gets the key from a string enum', () => {
    expect(getEnumKey('OTHER' as any, AStringEnum)).toBeUndefined();
    expect(getEnumKey(AStringEnum.Up, AStringEnum)).toEqual('Up');
  });
});
