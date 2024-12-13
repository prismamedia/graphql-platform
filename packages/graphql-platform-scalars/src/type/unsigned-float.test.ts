import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLUnsignedFloat } from './unsigned-float.js';

describe('UnsignedFloat', () => {
  describe('invalids', () => {
    [
      [-0, 'Expects an unsigned float, got: -0'],
      [-0.0, 'Expects an unsigned float, got: -0'],
      [-12, 'Expects an unsigned float, got: -12'],
      [-34.56, 'Expects an unsigned float, got: -34.56'],
      ['78', 'Float cannot represent non numeric value: "78"'],
    ].forEach(([input, error]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLUnsignedFloat.parseValue(input), {
          message: error,
        });
      });
    });
  });

  describe('valids', () => {
    [
      [0, 0],
      [0.0, 0],
      [12, 12],
      [34.56, 34.56],
    ].forEach(([input, output]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLUnsignedFloat.parseValue(input), input);
      });
    });
  });
});
