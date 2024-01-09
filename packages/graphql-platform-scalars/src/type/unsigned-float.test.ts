import { describe, expect, it } from '@jest/globals';
import { GraphQLUnsignedFloat } from './unsigned-float.js';

describe('UnsignedFloat', () => {
  it.each([[0], [0.0], [12], [34.56]])('parseValue(%p) = %p', (input) => {
    expect(GraphQLUnsignedFloat.parseValue(input)).toBe(input);
  });

  it.each([
    [-0, 'Expects an unsigned float, got: -0'],
    [-0.0, 'Expects an unsigned float, got: -0'],
    [-12, 'Expects an unsigned float, got: -12'],
    [-34.56, 'Expects an unsigned float, got: -34.56'],
    ['78', 'Float cannot represent non numeric value: "78"'],
  ])('parseValue(%p) throws the following Error: %s', (input, error) => {
    expect(() => GraphQLUnsignedFloat.parseValue(input)).toThrow(error);
  });
});
