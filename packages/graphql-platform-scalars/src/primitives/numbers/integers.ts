import { GraphQLInt } from 'graphql';
import {
  GraphQLNegativeInt,
  GraphQLNonNegativeInt,
  GraphQLNonPositiveInt,
  GraphQLPositiveInt,
} from 'graphql-scalars';
import { TypedGraphQLScalarType } from '../../types';

export const integerScalarTypes = Object.freeze([
  GraphQLInt as TypedGraphQLScalarType<'Int', number>,

  // > 0
  GraphQLPositiveInt as TypedGraphQLScalarType<'PositiveInt', number>,

  // >= 0
  GraphQLNonNegativeInt as TypedGraphQLScalarType<'NonNegativeInt', number>,

  // < 0
  GraphQLNegativeInt as TypedGraphQLScalarType<'NegativeInt', number>,

  // <= 0
  GraphQLNonPositiveInt as TypedGraphQLScalarType<'NonPositiveInt', number>,
]);
