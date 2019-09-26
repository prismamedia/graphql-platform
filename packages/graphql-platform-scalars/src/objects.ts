import {
  GraphQLDate,
  GraphQLDateTime,
  GraphQLJSONObject,
  GraphQLTime,
} from 'graphql-scalars';
import { GraphQLDraftJS } from './objects/draft-js';
import { GraphQLURL } from './objects/url';
import { TypedGraphQLScalarType } from './types';

export const DateScalarTypes = Object.freeze([
  GraphQLDate as TypedGraphQLScalarType<'Date', Date, string>,
  GraphQLDateTime as TypedGraphQLScalarType<'DateTime', Date, string>,
  GraphQLTime as TypedGraphQLScalarType<'Time', Date, string>,
]);

export const objectScalarTypes = Object.freeze([
  ...DateScalarTypes,

  // others
  GraphQLDraftJS,
  GraphQLJSONObject as TypedGraphQLScalarType<'JSONObject', object>,
  GraphQLURL,
]);
