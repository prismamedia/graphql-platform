import { escapeIdentifier, escapeStringValue } from './escaping.js';

describe('Escaping', () => {
  it.each([
    ['articles', '`articles`'],
    ["let's do it", "`let's do it`"],
  ])('escapeIdentifier(%p) = %p', (input, output) =>
    expect(escapeIdentifier(input)).toEqual(output),
  );

  it.each([
    ["let'g'o😊", "'let\\'g\\'o😊'"],
    ["a\u0000'\nb\tc\rd \\e%_\u001a", "'a\\0\\'\\nb\\tc\\rd \\\\e%_\\Z'"],
    ['\u0000\u001a', "'\\0\\Z'"],
  ])('escapeStringValue(%p) = %p', (input, output) =>
    expect(escapeStringValue(input)).toEqual(output),
  );
});
