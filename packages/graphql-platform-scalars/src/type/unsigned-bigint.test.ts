import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLUnsignedBigInt } from './unsigned-bigint.js';

describe('UnsignedBigInt', () => {
  describe('invalids', () => {
    [
      [-12, 'Expects an unsigned BigInt, got: -12'],
      [-34n, 'Expects an unsigned BigInt, got: -34n'],
      ['-56', "Expects an unsigned BigInt, got: '-56'"],
    ].forEach(([input, error]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLUnsignedBigInt.parseValue(input), {
          message: error,
        });
      });
    });
  });

  describe('valids', () => {
    [
      [-0, 0n],
      [-0n, 0n],
      [0, 0n],
      [0n, 0n],
      [12, 12n],
      [34n, 34n],
      [BigInt('56'), 56n],
      ['78', 78n],
    ].forEach(([input, output]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLUnsignedBigInt.parseValue(input), output);
      });
    });
  });
});
