import { GraphQLID, GraphQLString } from 'graphql';
import {
  GraphQLDuration,
  GraphQLEmailAddress,
  GraphQLIBAN,
  GraphQLIPv4,
  GraphQLIPv6,
  GraphQLISBN,
  GraphQLMAC,
  GraphQLNonEmptyString,
  GraphQLUUID,
} from 'graphql-scalars';
import { TypedGraphQLScalarType } from '../types';
import { GraphQLNonEmptyTrimmedString } from './strings/non-empty-trimmed-string';

export const stringScalarTypes = Object.freeze([
  GraphQLDuration as TypedGraphQLScalarType<'Duration', string>,
  GraphQLEmailAddress as TypedGraphQLScalarType<'EmailAddress', string>,
  GraphQLIBAN as TypedGraphQLScalarType<'IBAN', string>,
  GraphQLID as TypedGraphQLScalarType<'ID', string>,
  GraphQLIPv4 as TypedGraphQLScalarType<'IPv4', string>,
  GraphQLIPv6 as TypedGraphQLScalarType<'IPv6', string>,
  GraphQLISBN as TypedGraphQLScalarType<'ISBN', string>,
  GraphQLMAC as TypedGraphQLScalarType<'MAC', string>,
  GraphQLNonEmptyString as TypedGraphQLScalarType<'NonEmptyString', string>,
  GraphQLNonEmptyTrimmedString,
  GraphQLString as TypedGraphQLScalarType<'String', string>,
  GraphQLUUID as TypedGraphQLScalarType<'UUID', string>,
]);
