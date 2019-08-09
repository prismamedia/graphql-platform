import { getFlagValue } from '../flag';

describe('flag', () => {
  it('works', () => {
    expect(getFlagValue(undefined, true)).toBe(true);
    expect(getFlagValue(undefined, false)).toBe(false);

    expect(getFlagValue(null, true)).toBe(true);
    expect(getFlagValue(null, false)).toBe(false);

    expect(getFlagValue(true, true)).toBe(true);
    expect(getFlagValue(true, false)).toBe(true);

    expect(getFlagValue(false, true)).toBe(false);
    expect(getFlagValue(false, false)).toBe(false);
  });

  it('throws error on unsupported type', () => {
    expect(() => getFlagValue('' as any, true)).toThrowErrorMatchingInlineSnapshot(
      `"The flag value \\"\\" of type \\"string\\" has to be a boolean, null or undefined."`,
    );

    expect(() => getFlagValue('1' as any, true)).toThrowErrorMatchingInlineSnapshot(
      `"The flag value \\"1\\" of type \\"string\\" has to be a boolean, null or undefined."`,
    );

    expect(() => getFlagValue('true' as any, true)).toThrowErrorMatchingInlineSnapshot(
      `"The flag value \\"true\\" of type \\"string\\" has to be a boolean, null or undefined."`,
    );

    expect(() => getFlagValue(1 as any, true)).toThrowErrorMatchingInlineSnapshot(
      `"The flag value \\"1\\" of type \\"number\\" has to be a boolean, null or undefined."`,
    );

    expect(() => getFlagValue({} as any, true)).toThrowErrorMatchingInlineSnapshot(
      `"The flag value \\"[object Object]\\" of type \\"object\\" has to be a boolean, null or undefined."`,
    );
  });
});
