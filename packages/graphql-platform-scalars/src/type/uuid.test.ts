import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { uuidTypesByName } from './uuid.js';

describe('UUID', () => {
  describe('valids', () => {
    [
      // v1
      [
        'a861508e-4796-11ec-81d3-0242ac130003',
        'a861508e-4796-11ec-81d3-0242ac130003',
      ],
      [
        '5BA6E0BA-4796-11EC-81D3-0242AC130003',
        '5ba6e0ba-4796-11ec-81d3-0242ac130003',
      ],

      // v4
      [
        '0c053a1d-50c4-4134-a4c5-7792229c6c09',
        '0c053a1d-50c4-4134-a4c5-7792229c6c09',
      ],
      [
        'D4A97A6F-5035-4E25-A446-B3AC807D89DF',
        'd4a97a6f-5035-4e25-a446-b3ac807d89df',
      ],
    ].forEach(([value, expected]) => {
      it(`parseValue(${inspect(value, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.strictEqual(uuidTypesByName.UUID.parseValue(value), expected);
      });
    });

    // v1
    [
      [
        'a861508e-4796-11ec-81d3-0242ac130003',
        'a861508e-4796-11ec-81d3-0242ac130003',
      ],
      [
        '5BA6E0BA-4796-11EC-81D3-0242AC130003',
        '5ba6e0ba-4796-11ec-81d3-0242ac130003',
      ],
    ].forEach(([value, expected]) => {
      it(`v1.parseValue(${inspect(value, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.strictEqual(uuidTypesByName.UUIDv1.parseValue(value), expected);
      });
    });

    // v4
    [
      [
        '0c053a1d-50c4-4134-a4c5-7792229c6c09',
        '0c053a1d-50c4-4134-a4c5-7792229c6c09',
      ],
      [
        'D4A97A6F-5035-4E25-A446-B3AC807D89DF',
        'd4a97a6f-5035-4e25-a446-b3ac807d89df',
      ],
    ].forEach(([value, expected]) => {
      it(`v4.parseValue(${inspect(value, undefined, 5)}) = ${inspect(expected, undefined, 5)}`, () => {
        assert.strictEqual(uuidTypesByName.UUIDv4.parseValue(value), expected);
      });
    });
  });
});
