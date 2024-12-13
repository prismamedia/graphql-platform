import assert from 'node:assert';
import { describe, it } from 'node:test';
import { ensureNodeName } from './name.js';

describe('Name', () => {
  describe('invalids', () => {
    ['invalidName', 'Invalid_name', '_InvalidName'].forEach((input) => {
      it(`"${input}" is not valid`, () => {
        assert.throws(() => ensureNodeName(input));
      });
    });
  });

  describe('valids', () => {
    ['Validname', 'ValidName'].forEach((input) => {
      it(`"${input}" is valid`, () => {
        assert.strictEqual(ensureNodeName(input), input);
      });
    });
  });
});
