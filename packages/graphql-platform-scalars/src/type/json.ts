import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { JsonObject, JsonPrimitive, JsonValue } from 'type-fest';

export function parseJsonObject(value: unknown, path?: utils.Path): JsonObject {
  utils.assertPlainObject(value, path);

  return utils.aggregateGraphError<any, JsonObject>(
    Object.entries(value),
    (object, [key, value]) =>
      Object.assign(object, {
        [key]: parseJsonValue(value, utils.addPath(path, key)),
      }),
    Object.create(null),
    { path },
  );
}

export function parseJsonArray(value: unknown, path?: utils.Path): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new utils.UnexpectedValueError(`an array`, value, {
      path,
    });
  }

  return utils.aggregateGraphError<any, JsonValue[]>(
    value,
    (values, value, index) => {
      values.push(parseJsonValue(value, utils.addPath(path, index)));

      return values;
    },
    [],
    { path },
  );
}

export function parseNonNullJsonPrimitive(
  value: unknown,
  path?: utils.Path,
): NonNullable<JsonPrimitive> {
  if (
    !(
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
  ) {
    throw new utils.UnexpectedValueError(
      `a non-null JSON primitive (= a string, a number or a boolean)`,
      value,
      { path },
    );
  }

  return value;
}

export function parseNonNullJsonValue(
  value: unknown,
  path?: utils.Path,
): NonNullable<JsonValue> {
  return utils.isPlainObject(value)
    ? parseJsonObject(value, path)
    : Array.isArray(value)
    ? parseJsonArray(value, path)
    : parseNonNullJsonPrimitive(value, path);
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

export const GraphQLJSONPrimitive = new graphql.GraphQLScalarType({
  name: 'JSONPrimitive',
  description: 'The `JSONPrimitive` scalar type represents JSON primitives.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseNonNullJsonPrimitive(value);
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.OBJECT) {
      return parseNonNullJsonPrimitive(
        graphql.valueFromASTUntyped(ast, variables),
      );
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonNullJsonPrimitive(value);
  },
});

export const GraphQLJSONValue = new graphql.GraphQLScalarType({
  name: 'JSONValue',
  description: 'The `JSONValue` scalar type represents JSON values.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseNonNullJsonValue(value);
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.OBJECT) {
      return parseNonNullJsonValue(graphql.valueFromASTUntyped(ast, variables));
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseNonNullJsonValue(value);
  },
});

export const jsonTypesByName = {
  JSONArray: GraphQLJSONArray,
  JSONObject: GraphQLJSONObject,
  JSONPrimitive: GraphQLJSONPrimitive,
  JSONValue: GraphQLJSONValue,
} satisfies Record<string, graphql.GraphQLScalarType>;

export const jsonTypes = Object.values(jsonTypesByName);
