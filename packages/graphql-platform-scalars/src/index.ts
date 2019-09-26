import assert from 'assert';
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

export type TScalarType = typeof scalarTypes extends Iterable<infer T>
  ? T
  : never;

export const scalarTypeByName = Object.freeze(
  Object.fromEntries(
    [...scalarTypes].map((scalarType) => [scalarType.name, scalarType]),
  ) as {
    [TName in TScalarType['name']]: Extract<TScalarType, { name: TName }>;
  },
);

export const isScalarTypeName = (
  maybeScalarTypeName: any,
): maybeScalarTypeName is TScalarType['name'] =>
  scalarTypeNames.includes(maybeScalarTypeName);

export const isScalarTypeAmong = <T extends TScalarType>(
  maybeScalarType: any,
  scalarTypes: ReadonlyArray<T>,
): maybeScalarType is T => scalarTypes.includes(maybeScalarType);

export default scalarTypeByName;
