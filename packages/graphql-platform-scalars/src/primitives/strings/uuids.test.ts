import { uuidScalarTypesByName } from './uuids.js';

describe('UUIDs', () => {
  it.each([
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
  ])('UUID.parseValue(%p) = %s', (value, expected) => {
    expect(uuidScalarTypesByName.UUID.parseValue(value)).toEqual(expected);
  });

  // v1
  it.each([
    [
      'a861508e-4796-11ec-81d3-0242ac130003',
      'a861508e-4796-11ec-81d3-0242ac130003',
    ],
    [
      '5BA6E0BA-4796-11EC-81D3-0242AC130003',
      '5ba6e0ba-4796-11ec-81d3-0242ac130003',
    ],
  ])('UUIDv1.parseValue(%p) = %s', (value, expected) => {
    expect(uuidScalarTypesByName.UUIDv1.parseValue(value)).toEqual(expected);
  });

  // v4
  it.each([
    [
      '0c053a1d-50c4-4134-a4c5-7792229c6c09',
      '0c053a1d-50c4-4134-a4c5-7792229c6c09',
    ],
    [
      'D4A97A6F-5035-4E25-A446-B3AC807D89DF',
      'd4a97a6f-5035-4e25-a446-b3ac807d89df',
    ],
  ])('UUIDv4.parseValue(%p) = %s', (value, expected) => {
    expect(uuidScalarTypesByName.UUIDv4.parseValue(value)).toEqual(expected);
  });
});
