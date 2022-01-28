import {
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { ValueOf } from 'type-fest';
import { objectScalarTypesByName } from './objects.js';
import { primitiveScalarTypesByName } from './primitives.js';

export * from './comparator.js';
export * from './objects.js';
export * from './primitives.js';

export const Scalars = {
  ...primitiveScalarTypesByName,
  ...objectScalarTypesByName,
};

type ScalarTypesByName = typeof Scalars;

export type ScalarTypeName = keyof ScalarTypesByName;

export const scalarTypeNames = Object.keys(Scalars) as ScalarTypeName[];

export type ScalarType = ValueOf<ScalarTypesByName>;

export type GetScalarInternalValue<TScalarType extends ScalarType> =
  TScalarType extends graphql.GraphQLScalarType<infer TInternalValue, any>
    ? TInternalValue
    : never;

export type GetScalarExternalValue<TScalarType extends ScalarType> =
  TScalarType extends graphql.GraphQLScalarType<any, infer TExternalValue>
    ? TExternalValue
    : never;

export const scalarTypes = Object.values(Scalars);

export function getScalarTypeByName(
  maybeScalarTypeName: ScalarTypeName,
  path?: Path,
): ScalarType {
  const scalarType = Scalars[maybeScalarTypeName];
  if (!scalarType) {
    throw new UnexpectedValueError(
      `a scalar type name among "${scalarTypeNames.join(', ')}"`,
      maybeScalarTypeName,
      { path },
    );
  }

  return scalarType;
}

export function assertScalarType(
  maybeScalarType: unknown,
  path?: Path,
): asserts maybeScalarType is ScalarType {
  if (!scalarTypes.includes(maybeScalarType as any)) {
    throw new UnexpectedValueError(
      `a scalar type among "${scalarTypeNames.join(', ')}"`,
      maybeScalarType,
      { path },
    );
  }
}

export function ensureScalarType(
  maybeScalarType: unknown,
  path?: Path,
): ScalarType {
  assertScalarType(maybeScalarType, path);

  return maybeScalarType;
}
