import * as graphql from 'graphql';
import { GraphQLUnsignedFloat } from './floats/unsigned.js';

export const floatScalarTypesByName = {
  Float: graphql.GraphQLFloat,

  // >= 0
  UnsignedFloat: GraphQLUnsignedFloat,
} as const;
