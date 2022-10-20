import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from 'type-fest';

export function parseJsonObject(value: unknown, path?: utils.Path): JsonObject {
  if (!utils.isPlainObject(value)) {
    throw new utils.UnexpectedValueError(`a plain-object`, value, {
      path,
    });
  }

  return utils.aggregateError<any, JsonObject>(
    Object.entries(value),
    (object, [key, value]) =>
      Object.assign(object, {
        [key]: parseJsonValue(value, utils.addPath(path, key)),
      }),
    Object.create(null),
    { path },
  );
}

export function parseJsonArray(value: unknown, path?: utils.Path): JsonArray {
  if (!Array.isArray(value)) {
    throw new utils.UnexpectedValueError(`an array`, value, {
      path,
    });
  }

  return utils.aggregateError<any, JsonArray>(
    value,
    (values, value, index) => [
      ...values,
      parseJsonValue(value, utils.addPath(path, index)),
    ],
    [],
    { path },
  );
}

export function parseJsonPrimitive(
  value: unknown,
  path?: utils.Path,
): JsonPrimitive {
  if (
    !(
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    )
  ) {
    throw new utils.UnexpectedValueError(
      `a JSON primitive (= a string, a number, a boolean or null)`,
      value,
      { path },
    );
  }

  return value;
}

export function parseJsonValue(value: unknown, path?: utils.Path): JsonValue {
  return utils.isPlainObject(value)
    ? parseJsonObject(value, path)
    : Array.isArray(value)
    ? parseJsonArray(value, path)
    : parseJsonPrimitive(value, path);
}

export const GraphQLJSONArray = new graphql.GraphQLScalarType({
  name: 'JSONArray',
  description: 'The `JSONArray` scalar type represents JSON arrays.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonArray(value);
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.LIST) {
      return parseJsonArray(graphql.valueFromASTUntyped(ast, variables));
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseJsonArray(value);
  },
});

export const GraphQLJSONObject = new graphql.GraphQLScalarType({
  name: 'JSONObject',
  description: 'The `JSONObject` scalar type represents JSON objects.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonObject(value);
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.OBJECT) {
      return parseJsonObject(graphql.valueFromASTUntyped(ast, variables));
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseJsonObject(value);
  },
});

export const jsonTypesByName = {
  JSONArray: GraphQLJSONArray,
  JSONObject: GraphQLJSONObject,
} as const;
