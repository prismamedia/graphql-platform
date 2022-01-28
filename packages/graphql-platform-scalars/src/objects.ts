import { GraphQLDateTime } from './objects/date-time.js';
import { GraphQLDate } from './objects/date.js';
import { GraphQLDraftJS } from './objects/draft-js.js';
import { jsonScalarTypesByName } from './objects/json.js';
import { GraphQLURL } from './objects/url.js';

export * from './objects/date-time.js';
export * from './objects/date.js';
export * from './objects/draft-js.js';
export * from './objects/json.js';
export * from './objects/url.js';

export const dateScalarTypesByName = {
  Date: GraphQLDate,
  DateTime: GraphQLDateTime,
} as const;

export const dateScalarTypes = Object.values(dateScalarTypesByName);

export const objectScalarTypesByName = {
  ...dateScalarTypesByName,
  ...jsonScalarTypesByName,

  // others
  DraftJS: GraphQLDraftJS,
  URL: GraphQLURL,
} as const;

export const objectScalarTypes = Object.values(objectScalarTypesByName);
