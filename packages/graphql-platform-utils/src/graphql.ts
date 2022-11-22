import * as graphql from 'graphql';
import { castToError } from './cast-to-error.js';
import { getEnumKeys } from './enum.js';
import { UnexpectedValueError } from './error.js';
import { indefinite } from './indefinite.js';
import { isNil, type Nillable } from './nil.js';
import { type Path } from './path.js';
import { isPlainObject, type PlainObject } from './plain-object.js';

export function isGraphQLResolveInfo(
  maybeGraphQLResolveInfo: unknown,
): maybeGraphQLResolveInfo is graphql.GraphQLResolveInfo {
  return (
    isPlainObject(maybeGraphQLResolveInfo) &&
    typeof maybeGraphQLResolveInfo.fieldName === 'string' &&
    Array.isArray(maybeGraphQLResolveInfo.fieldNodes) &&
    graphql.isOutputType(maybeGraphQLResolveInfo.returnType) &&
    graphql.isOutputType(maybeGraphQLResolveInfo.parentType)
  );
}

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

export function isGraphQLASTNode<TKind extends graphql.Kind>(
  maybeGraphQLASTNode: unknown,
  kind: TKind,
): maybeGraphQLASTNode is graphql.ASTKindToNode[TKind] {
  return (
    isPlainObject(maybeGraphQLASTNode) && maybeGraphQLASTNode.kind === kind
  );
}

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

export function parseGraphQLScalarValue<TInternal>(
  type: graphql.GraphQLScalarType<TInternal, any>,
  maybeScalarValue: unknown,
  path?: Path,
): Nillable<TInternal> {
  if (isNil(maybeScalarValue)) {
    return maybeScalarValue;
  }

  try {
    return type.parseValue(maybeScalarValue);
  } catch (error) {
    throw new UnexpectedValueError(indefinite(type.name), maybeScalarValue, {
      path,
      cause: castToError(error),
    });
  }
}

export function parseGraphQLEnumValue<TInternal = any>(
  type: graphql.GraphQLEnumType,
  maybeEnumValue: unknown,
  path?: Path,
): Nillable<TInternal> {
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
}

export function parseGraphQLLeafValue(
  type: graphql.GraphQLLeafType,
  maybeLeafValue: unknown,
  path?: Path,
): any {
  if (isNil(maybeLeafValue)) {
    return maybeLeafValue;
  }

  return graphql.isScalarType(type)
    ? parseGraphQLScalarValue(type, maybeLeafValue, path)
    : parseGraphQLEnumValue(type, maybeLeafValue, path);
}

export function createGraphQLEnumType(
  name: string,
  enumerable: PlainObject,
  description?: Nillable<string>,
  useKeyAsValue: boolean = false,
): graphql.GraphQLEnumType {
  return new graphql.GraphQLEnumType({
    name,
    description,
    values: Object.fromEntries(
      getEnumKeys(enumerable).map(
        (key): [string, graphql.GraphQLEnumValueConfig] => [
          key,
          { value: useKeyAsValue ? undefined : enumerable[key] },
        ],
      ),
    ),
  });
}
