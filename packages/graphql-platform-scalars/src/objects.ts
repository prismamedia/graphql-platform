import {
  GraphQLDate,
  GraphQLDateTime,
  GraphQLJSONObject,
  GraphQLTime,
} from 'graphql-scalars';
import { IterableElement } from 'type-fest';
import { GraphQLDraftJS } from './objects/draft-js';
import { GraphQLURL } from './objects/url';
import { TypedGraphQLScalarType } from './types';

export * from './objects/draft-js';
export * from './objects/url';

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

export type ObjectScalarType = IterableElement<typeof objectScalarTypes>;
