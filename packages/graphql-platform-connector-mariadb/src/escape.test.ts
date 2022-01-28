import { escapeStringValue } from './escape.js';

describe('Escape', () => {
  it.each([
    ["let'g'o😊", "'let\\'g\\'o😊'"],
    ["a\u0000'\nb\tc\rd \\e%_\u001a", "'a\\0\\'\\nb\\tc\\rd \\\\e%_\\Z'"],
    ['\u0000\u001a', "'\\0\\Z'"],
  ])('escape(%p) = %p', (input, output) =>
    expect(escapeStringValue(input)).toEqual(output),
  );
});
