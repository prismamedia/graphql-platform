import * as graphql from 'graphql';
import { UnexpectedConfigError } from '../../error.js';
import { parseGraphQLLeafValue } from '../../graphql.js';
import { Path } from '../../path.js';
import { EnumInputType } from './named/enum.js';
import { ObjectInputType } from './named/object.js';

export * from './named/enum.js';
export * from './named/object.js';

export type NamedInputType =
  // Leaves
  | graphql.GraphQLLeafType
  // Enums
  | EnumInputType
  // Objects
  | ObjectInputType;

export function isNamedInputType(
  maybeNamedInputType: unknown,
): maybeNamedInputType is NamedInputType {
  return (
    // GraphQL Leaves
    graphql.isLeafType(maybeNamedInputType) ||
    // Enums
    maybeNamedInputType instanceof EnumInputType ||
    // Objects
    maybeNamedInputType instanceof ObjectInputType
  );
}

export function assertNamedInputType(
  maybeNamedInputType: unknown,
  path: Path,
): asserts maybeNamedInputType is NamedInputType {
  if (!isNamedInputType(maybeNamedInputType)) {
    throw new UnexpectedConfigError(`a named input type`, maybeNamedInputType, {
      path,
    });
  }
}

export function ensureNamedInputType(
  maybeNamedInputType: unknown,
  path: Path,
): NamedInputType {
  assertNamedInputType(maybeNamedInputType, path);

  return maybeNamedInputType;
}

export function isNamedInputTypePublic(type: NamedInputType): boolean {
  return graphql.isLeafType(type) ? true : type.isPublic();
}

export function validateNamedInputType(type: NamedInputType): void {
  if (graphql.isLeafType(type)) {
    // Nothing to validate
  } else {
    type.validate();
  }
}

export function getGraphQLNamedInputType(
  type: NamedInputType,
): Extract<graphql.GraphQLNamedType, graphql.GraphQLInputType> {
  return graphql.isLeafType(type) ? type : type.getGraphQLInputType();
}

export function parseNamedInputValue(
  type: NamedInputType,
  maybeValue: unknown,
  path?: Path,
): any {
  return graphql.isLeafType(type)
    ? parseGraphQLLeafValue(type, maybeValue, path)
    : type.parseValue(maybeValue, path);
}
