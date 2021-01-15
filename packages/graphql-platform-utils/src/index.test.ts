import {
  addPath,
  didYouMean,
  fromObjectEntries,
  getObjectEntries,
  getObjectKeys,
  getObjectValues,
  getOptionalFlagValue,
  mapObject,
  printPath,
} from './';

describe('Utils', () => {
  it('has a working "getOptionalFlagValue" method', () => {
    expect(getOptionalFlagValue(undefined, true)).toBeTruthy();
    expect(getOptionalFlagValue(undefined, false)).toBeFalsy();
    expect(getOptionalFlagValue(true, true)).toBeTruthy();
    expect(getOptionalFlagValue(true, false)).toBeTruthy();
    expect(getOptionalFlagValue(false, true)).toBeFalsy();
    expect(getOptionalFlagValue(false, false)).toBeFalsy();

    expect(() =>
      // @ts-expect-error
      getOptionalFlagValue(null, true),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expects a boolean value, got \\"null\\""`,
    );

    expect(() =>
      // @ts-expect-error
      getOptionalFlagValue({}, true),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expects a boolean value, got \\"[object Object]\\""`,
    );
  });

  it('has a working "didYouMean" method', () => {
    expect(didYouMean('user', ['Article', 'User', 'uSer'])).toEqual(
      'User, uSer, Article',
    );
  });

  it('has properly typed "object" methods', () => {
    const object = { one: true, two: false, three: 'whatever' };

    expect(getObjectKeys(object)).toEqual(['one', 'two', 'three']);
    expect(getObjectValues(object)).toEqual([true, false, 'whatever']);
    expect(getObjectEntries(object)).toEqual([
      ['one', true],
      ['two', false],
      ['three', 'whatever'],
    ]);
    expect(fromObjectEntries(getObjectEntries(object))).toEqual(object);
    expect(mapObject(object, (value) => !!value)).toEqual({
      one: true,
      two: false,
      three: true,
    });
  });

  it('has useful path', () => {
    const root = addPath(undefined, 'Root');

    expect(printPath(addPath(root, 'FirstLevelChild'))).toEqual(
      'Root.FirstLevelChild',
    );

    expect(
      printPath(
        addPath(addPath(addPath(root, 'FirstLevelChild'), 0), 'FirstElement'),
      ),
    ).toEqual('Root.FirstLevelChild.0.FirstElement');
  });
});
