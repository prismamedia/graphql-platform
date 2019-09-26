import { getNormalizedObject } from './object';

describe('Object', () => {
  it('normalizes an object', () => {
    const object = Object.freeze({
      myKey: 'myValue',
      myOtherKey: {
        myDeepKey: 'myDeepValue',
      },
      myUndefinedKey: undefined,
    });

    expect(getNormalizedObject(object)).toEqual({
      myKey: 'myValue',
      myOtherKey: {
        myDeepKey: 'myDeepValue',
      },
    });

    expect(getNormalizedObject({ a: undefined, b: { c: undefined } })).toEqual({
      b: { c: undefined },
    });

    expect(getNormalizedObject({ a: undefined, b: undefined })).toBeUndefined();
  });
});
