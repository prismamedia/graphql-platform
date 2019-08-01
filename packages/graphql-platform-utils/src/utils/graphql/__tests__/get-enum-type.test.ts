import { printType } from 'graphql';
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
    expect(printType(getGraphQLEnumType('ANumericEnum', ANumericEnum))).toMatchSnapshot();
  });

  it('creates an enum type from numeric enum using "key as value"', () => {
    expect(printType(getGraphQLEnumType('ANumericEnumUsingKeyAsValue', ANumericEnum, true))).toMatchSnapshot();
  });

  it('creates an enum type from string enum', () => {
    expect(printType(getGraphQLEnumType('AStringEnum', AStringEnum))).toMatchSnapshot();
  });

  it('creates an enum type from string enum using "key as value"', () => {
    expect(printType(getGraphQLEnumType('AStringEnumUsingKeyAsValue', AStringEnum, true))).toMatchSnapshot();
  });
});
