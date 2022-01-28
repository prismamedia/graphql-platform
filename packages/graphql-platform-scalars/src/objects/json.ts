import {
  addPath,
  aggregateError,
  isPlainObject,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from 'type-fest';

export function parseJsonValue(value: unknown, path?: Path): JsonValue {
  return isPlainObject(value)
    ? parseJsonObject(value, path)
    : Array.isArray(value)
    ? parseJsonArray(value, path)
    : parseJsonPrimitive(value, path);
}

export function parseJsonPrimitive(value: unknown, path?: Path): JsonPrimitive {
  if (
    !(
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    )
  ) {
    throw new UnexpectedValueError(
      `a JSON primitive (= a string, a number, a boolean or null)`,
      value,
      { path },
    );
  }

  return value;
}

export function parseJsonArray(value: unknown, path?: Path): JsonArray {
  if (!Array.isArray(value)) {
    throw new UnexpectedValueError(`an array`, value, {
      path,
    });
  }

  return aggregateError<any, JsonArray>(
    value,
    (values, value, index) => [
      ...values,
      parseJsonValue(value, addPath(path, index)),
    ],
    [],
    { path },
  );
}

export function parseJsonObject(value: unknown, path?: Path): JsonObject {
  if (!isPlainObject(value)) {
    throw new UnexpectedValueError(`a plain-object`, value, {
      path,
    });
  }

  return aggregateError<any, JsonObject>(
    Object.entries(value),
    (object, [key, value]) =>
      Object.assign(object, {
        [key]: parseJsonValue(value, addPath(path, key)),
      }),
    Object.create(null),
    { path },
  );
}

export const GraphQLJSONArray = new graphql.GraphQLScalarType({
  name: 'JSONArray',
  description: 'The `JSONArray` scalar type represents JSON arrays.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonArray(value, addPath(undefined, this.name));
  },
  parseLiteral(ast, variables) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.LIST) {
      return parseJsonArray(graphql.valueFromASTUntyped(ast, variables), path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseJsonArray(value, addPath(undefined, this.name));
  },
});

export const GraphQLJSONObject = new graphql.GraphQLScalarType({
  name: 'JSONObject',
  description: 'The `JSONObject` scalar type represents JSON objects.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonObject(value, addPath(undefined, this.name));
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.OBJECT) {
      return parseJsonObject(
        graphql.valueFromASTUntyped(ast, variables),
        addPath(undefined, this.name),
      );
    }

    throw new TypeError(
      `${this.name} cannot parse literal: ${graphql.print(ast)}`,
    );
  },
  serialize(value: unknown) {
    return parseJsonObject(value, addPath(undefined, this.name));
  },
});

export const GraphQLJSONPrimitive = new graphql.GraphQLScalarType({
  name: 'JSONPrimitive',
  description: 'The `JSONPrimitive` scalar type represents JSON primitives.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonPrimitive(value, addPath(undefined, this.name));
  },
  parseLiteral(ast, variables) {
    return parseJsonPrimitive(
      graphql.valueFromASTUntyped(ast, variables),
      addPath(undefined, this.name),
    );
  },
  serialize(value: unknown) {
    return parseJsonPrimitive(value, addPath(undefined, this.name));
  },
});

export const GraphQLJSONValue = new graphql.GraphQLScalarType({
  name: 'JSONValue',
  description: 'The `JSONValue` scalar type represents JSON values.',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
  parseValue(value: unknown) {
    return parseJsonValue(value, addPath(undefined, this.name));
  },
  parseLiteral(ast, variables) {
    return parseJsonValue(
      graphql.valueFromASTUntyped(ast, variables),
      addPath(undefined, this.name),
    );
  },
  serialize(value: unknown) {
    return parseJsonValue(value, addPath(undefined, this.name));
  },
});

export const jsonScalarTypesByName = {
  JSONArray: GraphQLJSONArray,
  JSONObject: GraphQLJSONObject,
  // JSONPrimitive: GraphQLJSONPrimitive,
  // JSONValue: GraphQLJSONValue
} as const;

export const jsonScalarTypes = Object.values(jsonScalarTypesByName);
