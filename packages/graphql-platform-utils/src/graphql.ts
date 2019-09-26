import {
  GraphQLArgumentConfig,
  GraphQLEnumType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLType,
  isLeafType,
  isListType,
  isNonNullType,
  isOutputType,
  isScalarType,
  isSchema,
  isWrappingType,
} from 'graphql';
import { isEqual } from 'lodash';
import { isIterable } from '.';
import { UnexpectedValueError } from './errors';
import { isPlainObject, PlainObject } from './object';
import { addPath, Path } from './path';

export type GraphQLArgumentConfigMap<TArgs extends PlainObject | undefined> = {
  readonly [argName in keyof TArgs]: GraphQLArgumentConfig;
};

export const GraphQLNonNullDecorator = <T extends GraphQLType>(
  type: T,
  nonNull: boolean,
) =>
  isNonNullType(type)
    ? nonNull
      ? type
      : type.ofType
    : nonNull
    ? GraphQLNonNull(type)
    : type;

export const GraphQLListDecorator = <T extends GraphQLType>(
  type: T,
  list: boolean,
) => (list ? GraphQLList(type) : type);

export function isGraphQLResolveInfo(
  value: unknown,
): value is GraphQLResolveInfo {
  return (
    isPlainObject(value) &&
    'fieldName' in value &&
    typeof value.fieldName === 'string' &&
    'fieldNodes' in value &&
    Array.isArray(value.fieldNodes) &&
    'returnType' in value &&
    isOutputType(value.returnType) &&
    'parentType' in value &&
    isOutputType(value.parentType) &&
    'path' in value &&
    'schema' in value &&
    isSchema(value.schema)
  );
}

export function assertScalarValue(
  type: GraphQLScalarType,
  value: any,
  path?: Path,
) {
  let parsedValue;

  try {
    parsedValue = type.parseValue(value);
  } catch (error) {
    throw new UnexpectedValueError(value, `a "${type}"`, path);
  }

  // Should never happen
  if (parsedValue == null) {
    throw new UnexpectedValueError(parsedValue, `a "${type}"`, path);
  }

  return parsedValue;
}

export function assertEnumValue(
  type: GraphQLEnumType,
  value: any,
  path?: Path,
) {
  const enumValue = type
    .getValues()
    .find((enumValue) => isEqual(enumValue.value, value));

  if (enumValue === undefined) {
    throw new UnexpectedValueError(
      value,
      `a "${type}" (= a value among "${type
        .getValues()
        .map(({ value }) => value)
        .join(', ')}")`,
      path,
    );
  }

  return enumValue.value;
}

export function assertLeafValue(
  type: GraphQLLeafType,
  value: any,
  path?: Path,
): any {
  return isScalarType(type)
    ? assertScalarValue(type, value, path)
    : assertEnumValue(type, value, path);
}

export function isLeafValue(type: GraphQLLeafType, value: any): boolean {
  try {
    isScalarType(type)
      ? assertScalarValue(type, value)
      : assertEnumValue(type, value);

    return true;
  } catch (error) {
    return false;
  }
}

export function isWrappedLeafType(
  maybeWrappedLeafType: unknown,
): maybeWrappedLeafType is GraphQLType {
  return isWrappingType(maybeWrappedLeafType)
    ? isWrappedLeafType(maybeWrappedLeafType.ofType)
    : isLeafType(maybeWrappedLeafType);
}

export function assertWrappedLeafValue(
  type: GraphQLType,
  value: any,
  path?: Path,
): any {
  if (value === undefined) {
    throw new UnexpectedValueError(value, `a "${type}"`, path);
  } else if (value === null) {
    if (isNonNullType(type)) {
      throw new UnexpectedValueError(
        value,
        `a non-null "${type.ofType}"`,
        path,
      );
    }

    return value;
  }

  if (isNonNullType(type)) {
    return assertWrappedLeafValue(type.ofType, value, path);
  } else if (isListType(type)) {
    if (!isIterable(value)) {
      throw new UnexpectedValueError(value, `a list of "${type.ofType}"`, path);
    }

    return Array.from(value, (value, index) =>
      assertWrappedLeafValue(type.ofType, value, addPath(path, index)),
    );
  } else if (isLeafType(type)) {
    return assertLeafValue(type, value, path);
  }
}
