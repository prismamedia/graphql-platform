import assert from 'node:assert';
import { describe, it } from 'node:test';
import { escapeIdentifier, escapeStringValue } from './escaping.js';

describe('Escaping', () => {
  (
    [
      ['articles', '`articles`'],
      ["let's do it", "`let's do it`"],
    ] satisfies ReadonlyArray<[string, string]>
  ).forEach(([input, output]) => {
    it(`escapeIdentifier(${input}) = ${output}`, () =>
      assert.strictEqual(escapeIdentifier(input), output));
  });

  (
    [
      ["let'g'o😊", "'let\\'g\\'o😊'"],
      ["a\u0000'\nb\tc\rd \\e%_\u001a", "'a\\0\\'\\nb\\tc\\rd \\\\e%_\\Z'"],
      ['\u0000\u001a', "'\\0\\Z'"],
    ] satisfies ReadonlyArray<[string, string]>
  ).forEach(([input, output]) => {
    it(`escapeStringValue(${input}) = ${output}`, () =>
      assert.strictEqual(escapeStringValue(input), output));
  });
});
