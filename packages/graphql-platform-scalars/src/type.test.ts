import { describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import { types } from './type.js';

describe('Type', () => {
  it.each(
    types.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      [scalarType, null],
    ]),
  )('throws an Error on %s.parseValue(%s)', (scalarType, value) => {
    expect(() => scalarType.parseValue(value)).toThrowError();
  });

  it.each(
    types.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      [scalarType, null],
    ]),
  )('throws an Error on %s.parseLiteral(%s)', (scalarType, value) => {
    expect(() => scalarType.parseLiteral(value)).toThrowError();
  });

  it.each(
    types.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      [scalarType, null],
    ]),
  )('throws an Error on %s.serialize(%s)', (scalarType, value) => {
    expect(() => scalarType.serialize(value)).toThrowError();
  });
});
