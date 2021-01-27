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
  isListType,
  isNonNullType,
  isOutputType,
  isScalarType,
  isSchema,
  OperationTypeNode,
  valueFromASTUntyped,
} from 'graphql';
import { isEqual } from 'lodash';
import { UnexpectedValueError } from './errors';
import { indefiniteQuote } from './indefinite';
import { isPlainObject, normalizeObject, PlainObject } from './object';
import { Path } from './path';

export const valueFromArgumentNodes = (
  argumentNodes: ReadonlyArray<ArgumentNode>,
  variables?: GraphQLResolveInfo['variableValues'],
) =>
  normalizeObject(
    Object.fromEntries(
      argumentNodes.map(({ name, value }) => [
        name.value,
        valueFromASTUntyped(value, variables),
      ]),
    ),
  );

export const operationTypes: ReadonlyArray<OperationTypeNode> = Object.freeze([
  'query',
  'mutation',
  'subscription',
]);

export type GraphQLArgumentConfigMap<TArgs extends PlainObject | undefined> = {
  readonly [argName in keyof TArgs]: GraphQLArgumentConfig;
};

export const GraphQLNonNullDecorator = (type: GraphQLType, nonNull: boolean) =>
  isNonNullType(type) && !nonNull
    ? type.ofType
    : !isNonNullType(type) && nonNull
    ? new GraphQLNonNull(type)
    : type;

export const GraphQLListDecorator = (type: GraphQLType, list: boolean) =>
  isListType(type) && !list
    ? type.ofType
    : !isListType(type) && list
    ? new GraphQLList(type)
    : type;

export function isGraphQLResolveInfo(
  value: unknown,
): value is GraphQLResolveInfo {
  return (
    isPlainObject(value) &&
    typeof value.fieldName === 'string' &&
    Array.isArray(value.fieldNodes) &&
    isOutputType(value.returnType) &&
    isOutputType(value.parentType) &&
    'path' in value &&
    isSchema(value.schema)
  );
}

export function assertGraphQLScalarValue<TValue = any>(
  type: GraphQLScalarType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  if (maybeValue == null) {
    return maybeValue as any;
  }

  let parsedValue;

  try {
    parsedValue = type.parseValue(maybeValue);
  } catch {
    throw new UnexpectedValueError(maybeValue, indefiniteQuote(type), path);
  }

  // Should never happen
  if (parsedValue == null) {
    throw new UnexpectedValueError(parsedValue, indefiniteQuote(type), path);
  }

  return parsedValue;
}

export function assertGraphQLEnumValue<TValue = any>(
  type: GraphQLEnumType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  if (maybeValue == null) {
    return maybeValue as any;
  }

  if (!type.getValues().some((value) => isEqual(value.value, maybeValue))) {
    throw new UnexpectedValueError(
      maybeValue,
      `a "${type}" (= a value among "${type
        .getValues()
        .map(({ value }) => value)
        .join(', ')}")`,
      path,
    );
  }

  return maybeValue as any;
}

export function assertGraphQLLeafValue<TValue = any>(
  type: GraphQLLeafType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  return isScalarType(type)
    ? assertGraphQLScalarValue(type, maybeValue, path)
    : assertGraphQLEnumValue(type, maybeValue, path);
}

export function isGraphQLLeafValue<TValue = any>(
  type: GraphQLLeafType,
  maybeValue: unknown,
): maybeValue is TValue {
  try {
    assertGraphQLLeafValue(type, maybeValue);

    return true;
  } catch {
    return false;
  }
}
