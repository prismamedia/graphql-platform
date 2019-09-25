import { getGraphQLEnumType } from '../get-enum-type';

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

describe('getGraphQLEnumType', () => {
  it('creates an enum type from numeric enum', () => {
    expect(getGraphQLEnumType('ANumericEnum', ANumericEnum).toConfig()).toMatchSnapshot();
  });

  it('creates an enum type from numeric enum using "key as value"', () => {
    expect(getGraphQLEnumType('ANumericEnumUsingKeyAsValue', ANumericEnum, true).toConfig()).toMatchSnapshot();
  });

  it('creates an enum type from string enum', () => {
    expect(getGraphQLEnumType('AStringEnum', AStringEnum).toConfig()).toMatchSnapshot();
  });

  it('creates an enum type from string enum using "key as value"', () => {
    expect(getGraphQLEnumType('AStringEnumUsingKeyAsValue', AStringEnum, true).toConfig()).toMatchSnapshot();
  });
});
