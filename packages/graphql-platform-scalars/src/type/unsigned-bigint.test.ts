import { GraphQLUnsignedBigInt } from './unsigned-bigint.js';

describe('UnsignedBigInt', () => {
  it.each([
    [-0, 0n],
    [-0n, 0n],
    [0, 0n],
    [0n, 0n],
    [12, 12n],
    [34n, 34n],
    [BigInt('56'), 56n],
    ['78', 78n],
  ])('parseValue(%p) = %p', (input, output) => {
    expect(GraphQLUnsignedBigInt.parseValue(input)).toBe(output);
  });

  it.each([
    [-12, 'Expects an unsigned BigInt, got: -12'],
    [-34n, 'Expects an unsigned BigInt, got: -34n'],
    ['-56', "Expects an unsigned BigInt, got: '-56'"],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLUnsignedBigInt.parseValue(input)).toThrowError(error);
  });
});
