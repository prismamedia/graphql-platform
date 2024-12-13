import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { GraphQLBigInt } from './big-int.js';

describe('BigInt', () => {
  describe('invalids', () => {
    [
      ['', "Expects a BigInt, got: ''"],
      ['a123', 'Cannot convert a123 to a BigInt'],
    ].forEach(([input, error]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLBigInt.parseValue(input), {
          message: error,
        });
      });
    });
  });

  describe('valids', () => {
    [
      [12, 12n],
      [-12, -12n],
      [34n, 34n],
      [-34n, -34n],
      [BigInt('56'), 56n],
      [BigInt('-56'), -56n],
      ['78', 78n],
      ['-78', -78n],
    ].forEach(([input, output]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
        assert.strictEqual(GraphQLBigInt.parseValue(input), output);
      });
    });
  });
});
