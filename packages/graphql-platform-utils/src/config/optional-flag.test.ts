import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { addPath } from '../path.js';
import { getOptionalFlag, type OptionalFlag } from './optional-flag.js';

describe('OptionalFlag', () => {
  const configPath = addPath(undefined, 'GraphQLPlatformConfig');
  const optionalFlagConfigPath = addPath(configPath, 'private');

  {
    const cases = [
      [undefined, true, true],
      [undefined, false, false],
      [null, true, true],
      [null, false, false],
      [true, true, true],
      [true, false, true],
      [false, true, false],
      [false, false, false],
    ] as [OptionalFlag, boolean, boolean][];

    cases.forEach(([value, defaultValue, expectation]) =>
      it(`getOptionalFlag(${inspect(value, undefined, 5)}, ${defaultValue}) = ${expectation}`, () =>
        assert.strictEqual(
          getOptionalFlag(value, defaultValue, optionalFlagConfigPath),
          expectation,
        )),
    );
  }

  {
    const cases = [
      [{}, '/GraphQLPlatformConfig/private - Expects a boolean, got: {}'],
      [
        'true',
        `/GraphQLPlatformConfig/private - Expects a boolean, got: 'true'`,
      ],
    ] as [any, string][];

    cases.forEach(([invalidValue, error]) =>
      it(`getOptionalFlag(${inspect(invalidValue, undefined, 5)}, true) throws an error`, () =>
        assert.throws(
          () => getOptionalFlag(invalidValue, true, optionalFlagConfigPath),
          { message: error },
        )),
    );
  }
});
