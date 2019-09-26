import assert from 'assert';
import {
  ArgumentNode,
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
  ValueNode,
} from 'graphql';
import { pathToArray } from 'graphql/jsutils/Path';
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

export function parseValueNode(
  value: ValueNode,
  variables?: GraphQLResolveInfo['variableValues'],
): any {
  switch (value.kind) {
    case 'BooleanValue':
      return value.value;

    case 'IntValue':
      return Number.parseInt(value.value, 10);

    case 'FloatValue':
      return Number.parseFloat(value.value);

    case 'Variable':
      assert(isPlainObject(variables));
      assert(value.name.value in variables);

      return variables[value.name.value];

    case 'ObjectValue':
      return Object.fromEntries(
        value.fields.map((field) => [
          field.name.value,
          parseValueNode(field.value, variables),
        ]),
      );

    case 'ListValue':
      return value.values.map((value) => parseValueNode(value, variables));

    case 'NullValue':
      return null;

    default:
      return value.value;
  }
}

export const parseArgumentNodes = (
  args: ReadonlyArray<ArgumentNode>,
  variables?: GraphQLResolveInfo['variableValues'],
): PlainObject =>
  Object.fromEntries(
    args.map(({ name, value }) => [
      name.value,
      parseValueNode(value, variables),
    ]),
  );

export function getResolverPath(info: GraphQLResolveInfo): Path {
  return pathToArray(info.path).reduce(addPath, undefined) as Path;
}

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
    throw new UnexpectedValueError(value, `a "${type.name}"`, path);
  }

  // Should never happen
  if (parsedValue == null) {
    throw new UnexpectedValueError(parseValueNode, `a "${type.name}"`, path);
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
      `a value among "${type
        .getValues()
        .map(({ value }) => value)
        .join(', ')}"`,
      path,
    );
  }

  return enumValue.value;
}

export function assertLeafValue(
  type: GraphQLLeafType,
  value: any,
  path?: Path,
) {
  return isScalarType(type)
    ? assertScalarValue(type, value, path)
    : assertEnumValue(type, value, path);
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
      throw new UnexpectedValueError(value, `a "${type}"`, path);
    }

    return value;
  }

  if (isNonNullType(type)) {
    return assertWrappedLeafValue(type.ofType, value, path);
  } else if (isListType(type)) {
    if (!isIterable(value)) {
      throw new UnexpectedValueError(value, `a "${type}"`, path);
    }

    return Array.from(value, (value, index) =>
      assertWrappedLeafValue(type.ofType, value, addPath(path, index)),
    );
  } else if (isLeafType(type)) {
    return assertLeafValue(type, value, path);
  }
}
