import * as graphql from 'graphql';
import { GraphQLEmailAddress } from './strings/email-address.js';
import { GraphQLNonEmptyString } from './strings/non-empty-string.js';
import { GraphQLNonEmptyTrimmedString } from './strings/non-empty-trimmed-string.js';
import { uuidScalarTypesByName } from './strings/uuids.js';

export * from './strings/non-empty-string.js';
export * from './strings/non-empty-trimmed-string.js';
export * from './strings/uuids.js';

export const stringScalarTypesByName = {
  EmailAddress: GraphQLEmailAddress,
  ID: graphql.GraphQLID,
  NonEmptyString: GraphQLNonEmptyString,
  NonEmptyTrimmedString: GraphQLNonEmptyTrimmedString,
  String: graphql.GraphQLString,
  ...uuidScalarTypesByName,
} as const;
