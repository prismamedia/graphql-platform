import * as graphql from 'graphql';
import { scalarTypes } from './index.js';

describe('GraphQL Platform Scalars', () => {
  it.each(
    scalarTypes.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      // [scalarType, null],
    ]),
  )('throws an Error on %s.parseValue(%s)', (scalarType, value) => {
    expect(() => scalarType.parseValue(value)).toThrowError();
  });

  it.each(
    scalarTypes.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      // [scalarType, null],
    ]),
  )('throws an Error on %s.parseLiteral(%s)', (scalarType, value) => {
    expect(() => scalarType.parseLiteral(value)).toThrowError();
  });

  it.each(
    scalarTypes.flatMap((scalarType): [graphql.GraphQLScalarType, any][] => [
      [scalarType, undefined],
      // [scalarType, null],
    ]),
  )('throws an Error on %s.serialize(%s)', (scalarType, value) => {
    expect(() => scalarType.serialize(value)).toThrowError();
  });
});
