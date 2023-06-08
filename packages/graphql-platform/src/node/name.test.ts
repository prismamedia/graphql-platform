import { describe, expect, it } from '@jest/globals';
import { ensureNodeName } from './name.js';

describe('NodeName', () => {
  it.each(['invalidName', 'Invalid_name', '_InvalidName'])(
    '"%s" is not valid',
    (input) => {
      expect(() => ensureNodeName(input)).toThrowError();
    },
  );

  it.each(['Validname', 'ValidName'])('"%s" is valid', (input) =>
    expect(ensureNodeName(input)).toBe(input),
  );
});
