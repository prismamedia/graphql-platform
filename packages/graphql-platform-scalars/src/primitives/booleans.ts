import { GraphQLBoolean } from 'graphql';
import { TypedGraphQLScalarType } from '../types';

export const booleanScalarTypes = Object.freeze([
  GraphQLBoolean as TypedGraphQLScalarType<'Boolean', boolean>,
]);
