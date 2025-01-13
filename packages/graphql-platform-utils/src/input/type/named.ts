import * as graphql from 'graphql';
import { GraphError, UnexpectedValueError } from '../../error.js';
import {
  areGraphQLLeafValuesEqual,
  parseGraphQLEnumValue,
  parseGraphQLLeafValue,
} from '../../graphql.js';
import { indefinite } from '../../indefinite.js';
import type { Path } from '../../path.js';
import type { NonNullNonVariableGraphQLValueNode } from '../type.js';
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
    throw new UnexpectedValueError(`a named input type`, maybeNamedInputType, {
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

export function isNamedInputTypePublic(
  namedInputType: NamedInputType,
): boolean {
  return graphql.isLeafType(namedInputType) ? true : namedInputType.isPublic();
}

export function validateNamedInputType(namedInputType: NamedInputType): void {
  if (graphql.isLeafType(namedInputType)) {
    // Nothing to validate
  } else {
    namedInputType.validate();
  }
}

export function getGraphQLNamedInputType(
  namedInputType: NamedInputType,
): Extract<graphql.GraphQLNamedType, graphql.GraphQLInputType> {
  return graphql.isLeafType(namedInputType)
    ? namedInputType
    : namedInputType.getGraphQLInputType();
}

export function parseNamedInputValue(
  type: NamedInputType,
  value: unknown,
  path?: Path,
): any {
  return graphql.isLeafType(type)
    ? parseGraphQLLeafValue(type, value, path)
    : type.parseValue(value, path);
}

export function areNamedInputValuesEqual(
  type: NamedInputType,
  a: unknown,
  b: unknown,
): boolean {
  return a == null || b == null
    ? a === b
    : graphql.isLeafType(type)
      ? areGraphQLLeafValuesEqual(type, a, b)
      : type.areValuesEqual(a, b);
}

export function parseNamedInputLiteral(
  type: NamedInputType,
  value: NonNullNonVariableGraphQLValueNode,
  variableValues?: graphql.GraphQLResolveInfo['variableValues'],
  path?: Path,
): any {
  if (graphql.isLeafType(type)) {
    if (graphql.isScalarType(type)) {
      try {
        return type.parseLiteral(value, variableValues);
      } catch (error) {
        throw new UnexpectedValueError(
          indefinite(type.name),
          graphql.print(value),
          { path, cause: error },
        );
      }
    } else {
      if (value.kind === graphql.Kind.STRING) {
        return parseGraphQLEnumValue(type, value.value, path);
      } else if (value.kind === graphql.Kind.ENUM) {
        const enumValue = type
          .getValues()
          .find(({ name }) => name === value.value);

        if (!enumValue) {
          throw new UnexpectedValueError(
            `${indefinite(type.name)} (= a value among "${type
              .getValues()
              .map(({ name }) => name)
              .join(', ')}")`,
            graphql.print(value),
            { path },
          );
        }

        return enumValue.value;
      } else {
        throw new GraphError(`Cannot parse literal: ${graphql.print(value)}`, {
          path,
        });
      }
    }
  }

  return type.parseLiteral(value, variableValues, path);
}
