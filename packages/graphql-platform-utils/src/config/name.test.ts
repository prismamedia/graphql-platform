import { describe, expect, it } from '@jest/globals';
import { assertName } from './name.js';

describe('Name', () => {
  it.each<string>(['validName', 'ValidName', '_ValidName'])(
    'assertName(%p)',
    (value) => expect(assertName(value)).toBeUndefined(),
  );

  it.each<any>([
    undefined,
    null,
    '',
    {},
    '0InvalidName',
    'ïnvalidName',
    'invalid-name',
  ])('assertName(%p) throws the error %p', (invalidValue) =>
    expect(() => assertName(invalidValue)).toThrow(),
  );
});
