import { mapObjectValues, normalizeObject } from './object';

describe('Object', () => {
  it('deeply normalizes an object', () => {
    const object = Object.freeze({
      myKey: 'myValue',
      myOtherKey: {
        myDeepKey: 'myDeepValue',
        myDeepUndefinedKey: undefined,
      },
      myUndefinedKey: undefined,
    });

    expect(normalizeObject(object)).toEqual({
      myKey: 'myValue',
      myOtherKey: {
        myDeepKey: 'myDeepValue',
      },
    });

    expect(
      normalizeObject({ a: undefined, b: { c: undefined } }),
    ).toBeUndefined();
  });

  it('map object values', () => {
    expect(
      mapObjectValues({ a: 1, b: 2, c: 3 }, (value) =>
        value === 2 ? undefined : 2 * value,
      ),
    ).toEqual({ a: 2, c: 6 });
  });
});
