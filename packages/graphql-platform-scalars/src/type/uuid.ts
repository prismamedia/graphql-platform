import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { UUID } from 'node:crypto';

export type UUIDVersion = 1 | 2 | 3 | 4 | 5;

export function parseUUID(
  value: unknown,
  version?: UUIDVersion,
  path?: utils.Path,
): UUID {
  if (
    typeof value !== 'string' ||
    !new RegExp(
      `^[0-9a-f]{8}-[0-9a-f]{4}-${
        version ?? '[0-9]'
      }[0-9a-f]{3}-[89AB][0-9a-f]{3}-[0-9a-f]{12}$`,
      'i',
    ).test(value)
  ) {
    throw new utils.UnexpectedValueError(
      `an UUID${version ? ` version ${version}` : ''}`,
      value,
      { path },
    );
  }

  return value.toLowerCase() as UUID;
}

const buildGraphQLUUIDScalarType = (version?: UUIDVersion) =>
  new graphql.GraphQLScalarType({
    name: `UUID${version ? `v${version}` : ''}`,
    description: `A field whose value is a generic Universally Unique Identifier.`,
    specifiedByURL:
      'https://en.wikipedia.org/wiki/Universally_unique_identifier',
    parseValue(value: unknown) {
      return parseUUID(value, version);
    },
    parseLiteral(ast) {
      if (ast.kind === graphql.Kind.STRING) {
        return parseUUID(ast.value, version);
      }

      throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
    },
    serialize(value: unknown) {
      return parseUUID(value, version);
    },
  });

export const GraphQLUUID = buildGraphQLUUIDScalarType();
export const GraphQLUUIDv1 = buildGraphQLUUIDScalarType(1);
export const GraphQLUUIDv2 = buildGraphQLUUIDScalarType(2);
export const GraphQLUUIDv3 = buildGraphQLUUIDScalarType(3);
export const GraphQLUUIDv4 = buildGraphQLUUIDScalarType(4);
export const GraphQLUUIDv5 = buildGraphQLUUIDScalarType(5);

export const uuidTypesByName = {
  UUID: GraphQLUUID,
  UUIDv1: GraphQLUUIDv1,
  UUIDv2: GraphQLUUIDv2,
  UUIDv3: GraphQLUUIDv3,
  UUIDv4: GraphQLUUIDv4,
  UUIDv5: GraphQLUUIDv5,
} satisfies Record<string, graphql.GraphQLScalarType>;

export const uuidTypes = Object.values(uuidTypesByName);
