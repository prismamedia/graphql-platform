import { GraphQLFloat, GraphQLInt } from 'graphql';
import {
  GraphQLNegativeFloat,
  GraphQLNegativeInt,
  GraphQLNonNegativeFloat,
  GraphQLNonNegativeInt,
  GraphQLNonPositiveFloat,
  GraphQLNonPositiveInt,
  GraphQLPositiveFloat,
  GraphQLPositiveInt,
} from 'graphql-scalars';
import { TypedGraphQLScalarType } from '../types';

export const numberScalarTypes = Object.freeze([
  // floats
  GraphQLFloat as TypedGraphQLScalarType<'Float', number>,
  GraphQLNegativeFloat as TypedGraphQLScalarType<'NegativeFloat', number>,
  GraphQLNonNegativeFloat as TypedGraphQLScalarType<'NonNegativeFloat', number>,
  GraphQLNonPositiveFloat as TypedGraphQLScalarType<'NonPositiveFloat', number>,
  GraphQLPositiveFloat as TypedGraphQLScalarType<'PositiveFloat', number>,

  // integers
  GraphQLInt as TypedGraphQLScalarType<'Int', number>,
  GraphQLNegativeInt as TypedGraphQLScalarType<'NegativeInt', number>,
  GraphQLNonNegativeInt as TypedGraphQLScalarType<'NonNegativeInt', number>,
  GraphQLNonPositiveInt as TypedGraphQLScalarType<'NonPositiveInt', number>,
  GraphQLPositiveInt as TypedGraphQLScalarType<'PositiveInt', number>,
]);
