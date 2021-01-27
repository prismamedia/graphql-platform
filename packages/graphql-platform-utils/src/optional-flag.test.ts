import { getOptionalFlag } from './optional-flag';

describe('OptionalFlag', () => {
  it('works', () => {
    expect(getOptionalFlag(undefined, true)).toBe(true);
    expect(getOptionalFlag(undefined, false)).toBe(false);
    expect(getOptionalFlag(true, true)).toBe(true);
    expect(getOptionalFlag(true, false)).toBe(true);
    expect(getOptionalFlag(false, true)).toBe(false);
    expect(getOptionalFlag(false, false)).toBe(false);

    expect(() =>
      // @ts-expect-error
      getOptionalFlag(null, true),
    ).toThrowErrorMatchingInlineSnapshot(`"Expects a boolean, got: null"`);

    expect(() =>
      // @ts-expect-error
      getOptionalFlag({}, true),
    ).toThrowErrorMatchingInlineSnapshot(`"Expects a boolean, got: {}"`);
  });
});
