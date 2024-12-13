import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLUnsignedInt } from './unsigned-int.js';

describe('UnsignedInt', () => {
  [
    [-0, 'Expects an unsigned 32-bit integer, got: -0'],
    [-12, 'Expects an unsigned 32-bit integer, got: -12'],
    ['34', "Expects an unsigned 32-bit integer, got: '34'"],
  ].forEach(([input, error]) => {
    it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
      assert.throws(() => GraphQLUnsignedInt.parseValue(input), {
        message: error,
      });
    });
  });

  [
    [0, 0],
    [12, 12],
  ].forEach(([input, output]) => {
    it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
      assert.strictEqual(GraphQLUnsignedInt.parseValue(input), output);
    });
  });
});
