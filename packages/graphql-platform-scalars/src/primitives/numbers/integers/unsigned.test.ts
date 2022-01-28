import { GraphQLUnsignedInt } from './unsigned.js';

describe('UnsignedInt', () => {
  it.each([
    [0, 0],
    [12, 12],
  ])('parseValue(%p) = %p', (input) => {
    expect(GraphQLUnsignedInt.parseValue(input)).toBe(input);
  });

  it.each([
    [-0, 'Expects an unsigned 32-bit integer, got: -0'],
    [-12, 'Expects an unsigned 32-bit integer, got: -12'],
    ['34', 'Int cannot represent non-integer value: "34"'],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLUnsignedInt.parseValue(input)).toThrowError(error);
  });
});
