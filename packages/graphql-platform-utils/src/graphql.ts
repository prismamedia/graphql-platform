import * as graphql from 'graphql';
import { isDeepStrictEqual } from 'node:util';
import type { JsonValue } from 'type-fest';
import { ensureArray } from './array.js';
import { getOptionalFlag, type OptionalFlag } from './config.js';
import { getEnumKeys } from './enum.js';
import { UnexpectedValueError, UnreachableValueError } from './error.js';
import { indefinite } from './indefinite.js';
import { isNil, type Nillable } from './nil.js';
import { addPath, type Path } from './path.js';
import { isPlainObject, type PlainObject } from './plain-object.js';

export const isGraphQLResolveInfo = (
  maybeGraphQLResolveInfo: unknown,
): maybeGraphQLResolveInfo is graphql.GraphQLResolveInfo =>
  isPlainObject(maybeGraphQLResolveInfo) &&
  typeof maybeGraphQLResolveInfo['fieldName'] === 'string' &&
  Array.isArray(maybeGraphQLResolveInfo['fieldNodes']) &&
  graphql.isOutputType(maybeGraphQLResolveInfo['returnType']) &&
  graphql.isOutputType(maybeGraphQLResolveInfo['parentType']);

export function assertGraphQLResolveInfo(
  maybeGraphQLResolveInfo: unknown,
  path?: Path,
): asserts maybeGraphQLResolveInfo is graphql.GraphQLResolveInfo {
  if (!isGraphQLResolveInfo(maybeGraphQLResolveInfo)) {
    throw new UnexpectedValueError(
      `a GraphQLResolveInfo`,
      maybeGraphQLResolveInfo,
      { path },
    );
  }
}

export const isGraphQLASTNode = <TKind extends graphql.Kind>(
  maybeGraphQLASTNode: unknown,
  kind: TKind,
): maybeGraphQLASTNode is graphql.ASTKindToNode[TKind] =>
  isPlainObject(maybeGraphQLASTNode) && maybeGraphQLASTNode['kind'] === kind;

export function assertGraphQLASTNode<TKind extends graphql.Kind>(
  maybeGraphQLASTNode: unknown,
  kind: TKind,
  path?: Path,
): asserts maybeGraphQLASTNode is graphql.ASTKindToNode[TKind] {
  if (!isGraphQLASTNode(maybeGraphQLASTNode, kind)) {
    throw new UnexpectedValueError(`a GraphQL ${kind}`, maybeGraphQLASTNode, {
      path,
    });
  }
}

export const parseGraphQLScalarValue = <TInternal>(
  type: graphql.GraphQLScalarType<TInternal, any>,
  maybeScalarValue: unknown,
  path?: Path,
): Nillable<TInternal> => {
  if (isNil(maybeScalarValue)) {
    return maybeScalarValue;
  }

  try {
    return type.parseValue(maybeScalarValue);
  } catch (error) {
    throw new UnexpectedValueError(indefinite(type.name), maybeScalarValue, {
      cause: error,
      path,
    });
  }
};

export const parseGraphQLEnumValue = <TInternal = any>(
  type: graphql.GraphQLEnumType,
  maybeEnumValue: unknown,
  path?: Path,
): Nillable<TInternal> => {
  if (isNil(maybeEnumValue)) {
    return maybeEnumValue;
  }

  const enumValue = type
    .getValues()
    .find(({ value }) => value === maybeEnumValue);

  if (!enumValue) {
    throw new UnexpectedValueError(
      `${indefinite(type.name)} (= a value among "${type
        .getValues()
        .map(({ value }) => value)
        .join(', ')}")`,
      maybeEnumValue,
      { path },
    );
  }

  return enumValue.value;
};

export const parseGraphQLLeafValue = (
  type: graphql.GraphQLLeafType,
  maybeLeafValue: unknown,
  path?: Path,
): any => {
  if (isNil(maybeLeafValue)) {
    return maybeLeafValue;
  }

  return graphql.isScalarType(type)
    ? parseGraphQLScalarValue(type, maybeLeafValue, path)
    : parseGraphQLEnumValue(type, maybeLeafValue, path);
};

export const serializeGraphQLOutputType = (
  type: graphql.GraphQLOutputType,
  value: any,
  path?: Path,
): JsonValue => {
  if (value === null) {
    return value;
  } else if (graphql.isEnumType(type) || graphql.isScalarType(type)) {
    return type.serialize(value) as JsonValue;
  } else if (graphql.isNonNullType(type)) {
    return serializeGraphQLOutputType(type.ofType, value, path);
  } else if (graphql.isListType(type)) {
    return ensureArray(value, path).map((value, index) =>
      serializeGraphQLOutputType(type.ofType, value, addPath(path, index)),
    );
  } else if (graphql.isObjectType(type)) {
    return Object.entries(value).reduce(
      (object, [key, value]) =>
        Object.assign(object, {
          [key]: serializeGraphQLOutputType(
            type.getFields()[key].type,
            value,
            addPath(path, key),
          ),
        }),
      Object.create(null),
    );
  } else if (graphql.isInterfaceType(type) || graphql.isUnionType(type)) {
    throw new UnexpectedValueError(`a supported GraphQL output type`, type, {
      path,
    });
  }

  throw new UnreachableValueError(type, { path });
};

export const areGraphQLLeafValuesEqual = (
  _type: graphql.GraphQLLeafType,
  a: unknown,
  b: unknown,
): boolean =>
  a == null || b == null
    ? a === b
    : a instanceof Date && b instanceof Date
      ? a.getTime() === b.getTime()
      : a instanceof URL && b instanceof URL
        ? a.toString() === b.toString()
        : isDeepStrictEqual(a, b);

export type CreateGraphQLEnumTypeOptions = {
  description?: Nillable<string>;
  useKeyAsValue?: OptionalFlag;
};

export const createGraphQLEnumType = (
  name: string,
  enumerable: PlainObject,
  options?: CreateGraphQLEnumTypeOptions,
): graphql.GraphQLEnumType =>
  new graphql.GraphQLEnumType({
    name,
    description: options?.description,
    values: Object.fromEntries(
      getEnumKeys(enumerable).map<[string, graphql.GraphQLEnumValueConfig]>(
        (key) => [
          key,
          {
            value: getOptionalFlag(options?.useKeyAsValue, false)
              ? undefined
              : enumerable[key],
          },
        ],
      ),
    ),
  });
