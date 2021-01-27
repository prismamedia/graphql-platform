import { GraphQLFloat } from 'graphql';
import {
  GraphQLNegativeFloat,
  GraphQLNonNegativeFloat,
  GraphQLNonPositiveFloat,
  GraphQLPositiveFloat,
} from 'graphql-scalars';
import { TypedGraphQLScalarType } from '../../types';

export const floatScalarTypes = Object.freeze([
  GraphQLFloat as TypedGraphQLScalarType<'Float', number>,

  // > 0
  GraphQLPositiveFloat as TypedGraphQLScalarType<'PositiveFloat', number>,

  // >= 0
  GraphQLNonNegativeFloat as TypedGraphQLScalarType<'NonNegativeFloat', number>,

  // < 0
  GraphQLNegativeFloat as TypedGraphQLScalarType<'NegativeFloat', number>,

  // <= 0
  GraphQLNonPositiveFloat as TypedGraphQLScalarType<'NonPositiveFloat', number>,
]);
