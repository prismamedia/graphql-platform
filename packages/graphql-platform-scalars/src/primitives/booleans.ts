import * as graphql from 'graphql';

export const booleanScalarTypesByName = {
  Boolean: graphql.GraphQLBoolean,
} as const;
