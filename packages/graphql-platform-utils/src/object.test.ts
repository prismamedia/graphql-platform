import { normalizeObject } from './object';

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
});
