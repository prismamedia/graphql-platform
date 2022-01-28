import * as graphql from 'graphql';
import { GraphQLUnsignedInt } from './integers/unsigned.js';

export const integerScalarTypesByName = {
  Int: graphql.GraphQLInt,

  // >= 0
  UnsignedInt: GraphQLUnsignedInt,
} as const;
