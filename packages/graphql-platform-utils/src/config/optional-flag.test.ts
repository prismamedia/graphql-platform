import { addPath } from '../path.js';
import { getOptionalFlag, type OptionalFlag } from './optional-flag.js';

describe('OptionalFlag', () => {
  const configPath = addPath(undefined, 'GraphQLPlatformConfig');
  const optionalFlagConfigPath = addPath(configPath, 'private');

  it.each<[value: OptionalFlag, defaultValue: boolean, expectation: boolean]>([
    [undefined, true, true],
    [undefined, false, false],
    [null, true, true],
    [null, false, false],
    [true, true, true],
    [true, false, true],
    [false, true, false],
    [false, false, false],
  ])('getOptionalFlag(%p, %p) = %p', (value, defaultValue, expectation) =>
    expect(getOptionalFlag(value, defaultValue, optionalFlagConfigPath)).toBe(
      expectation,
    ),
  );

  it.each<[invalidValue: any, error: string]>([
    [{}, '/GraphQLPlatformConfig/private - Expects a boolean, got: {}'],
    ['true', `/GraphQLPlatformConfig/private - Expects a boolean, got: 'true'`],
  ])('getOptionalFlag(%p, true) throws the error %p', (invalidValue, error) =>
    expect(() =>
      getOptionalFlag(invalidValue, true, optionalFlagConfigPath),
    ).toThrowError(error),
  );
});
