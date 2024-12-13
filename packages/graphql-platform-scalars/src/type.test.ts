import assert from 'node:assert';
import { describe, it } from 'node:test';
import { types } from './type.js';

describe('Type', () => {
  types.forEach((scalarType) => {
    describe(scalarType.name, () => {
      it(`parseValue(undefined) throws an error`, () => {
        assert.throws(() => scalarType.parseValue(undefined));
      });

      it(`parseValue(null) throws an error`, () => {
        assert.throws(() => scalarType.parseValue(null));
      });

      it(`parseLiteral(undefined) throws an error`, () => {
        assert.throws(() => scalarType.parseLiteral(undefined as any));
      });

      it(`parseLiteral(null) throws an error`, () => {
        assert.throws(() => scalarType.parseLiteral(null as any));
      });

      it(`serialize(undefined) throws an error`, () => {
        assert.throws(() => scalarType.serialize(undefined as any));
      });

      it(`serialize(null) throws an error`, () => {
        assert.throws(() => scalarType.serialize(null as any));
      });
    });
  });
});
