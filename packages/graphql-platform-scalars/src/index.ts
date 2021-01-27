import assert from 'assert';
import { IterableElement } from 'type-fest';
import { objectScalarTypes } from './objects';
import { primitiveScalarTypes } from './primitives';

export * from './objects';
export * from './primitives';

export const scalarTypes = Object.freeze([
  ...primitiveScalarTypes,
  ...objectScalarTypes,
]);

export const scalarTypeNames = Object.freeze(
  scalarTypes.map((scalarType) => scalarType.name),
);

assert(
  new Set(scalarTypes.map(String)).size === scalarTypes.length,
  `At least 2 scalar types have the same name`,
);

export type ScalarType = IterableElement<typeof scalarTypes>;

export const Scalars = Object.freeze(
  Object.fromEntries(
    [...scalarTypes].map((scalarType) => [scalarType.name, scalarType]),
  ) as {
    [TName in ScalarType['name']]: Extract<ScalarType, { name: TName }>;
  },
);

export const isScalarTypeName = (
  maybeScalarTypeName: any,
): maybeScalarTypeName is ScalarType['name'] =>
  scalarTypeNames.includes(maybeScalarTypeName);

export const isScalarTypeAmong = <T extends ScalarType>(
  maybeScalarType: any,
  scalarTypes: ReadonlyArray<T>,
): maybeScalarType is T => scalarTypes.includes(maybeScalarType);

export const isScalarType = (
  maybeScalarType: any,
): maybeScalarType is ScalarType =>
  isScalarTypeAmong(maybeScalarType, scalarTypes);
