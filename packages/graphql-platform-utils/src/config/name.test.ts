import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { assertName } from './name.js';

describe('Name', () => {
  {
    const cases = ['validName', 'ValidName', '_ValidName'] as const;

    cases.forEach((value) =>
      it(`assertName(${inspect(value, undefined, 5)})`, () =>
        assert.strictEqual(assertName(value), undefined)),
    );
  }

  {
    const cases = [
      undefined,
      null,
      '',
      {},
      '0InvalidName',
      'ïnvalidName',
      'invalid-name',
    ] as const;

    cases.forEach((invalidValue) =>
      it(`assertName(${inspect(invalidValue, undefined, 5)}) throws an error`, () =>
        assert.throws(() => assertName(invalidValue))),
    );
  }
});
