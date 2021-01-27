import assert from 'assert';
import { GraphQLScalarType } from 'graphql';
import { UnreachableValueError } from '../../errors';
import { assertGraphQLScalarValue } from '../../graphql';
import { Path } from '../../path';
import {
  assertEnumerableInputValue,
  EnumerableInputType,
  isEnumerableInputType,
} from './named/enum';
import { assertInputObjectValue, InputObjectType } from './named/object';

export * from './named/enum';
export * from './named/object';

export type NamedInputType =
  // Scalars
  | GraphQLScalarType
  // Enums
  | EnumerableInputType
  // Objects
  | InputObjectType;

export function isNamedInputType(type: unknown): type is NamedInputType {
  return (
    // Scalars
    type instanceof GraphQLScalarType ||
    // Enums
    isEnumerableInputType(type) ||
    // Objects
    type instanceof InputObjectType
  );
}

export function assertNamedInputType(type: unknown): NamedInputType {
  assert(isNamedInputType(type), `"${type}" is not a named input type`);

  return type;
}

export function assertNamedInputValue<TValue = any>(
  type: NamedInputType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  if (maybeValue == null) {
    return maybeValue as any;
  }

  if (type instanceof GraphQLScalarType) {
    // Scalars
    return assertGraphQLScalarValue(type, maybeValue, path);
  } else if (isEnumerableInputType(type)) {
    // Enums
    return assertEnumerableInputValue(type, maybeValue, path);
  } else if (type instanceof InputObjectType) {
    // Objects
    return assertInputObjectValue(type, maybeValue, path);
  }

  throw new UnreachableValueError(type, `a supported named input type`, path);
}
