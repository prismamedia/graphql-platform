import { describe, expect, it } from '@jest/globals';
import { GraphQLBigInt } from './big-int.js';

describe('BigInt', () => {
  it.each([
    [12, 12n],
    [-12, -12n],
    [34n, 34n],
    [-34n, -34n],
    [BigInt('56'), 56n],
    [BigInt('-56'), -56n],
    ['78', 78n],
    ['-78', -78n],
  ])('parseValue(%p) = %p', (input, output) => {
    expect(GraphQLBigInt.parseValue(input)).toBe(output);
  });

  it.each([
    ['', "Expects a BigInt, got: ''"],
    ['a123', 'Cannot convert a123 to a BigInt'],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLBigInt.parseValue(input)).toThrow(error);
  });
});
