import assert from 'assert';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { UnexpectedValueError, UnreachableValueError } from '../../errors';
import { isIterableObject } from '../../iterable';
import { addPath, Path } from '../../path';
import { assertInputValue, InputType } from '../type';
import type { NamedInputType } from './named';
import {
  isListableInputType,
  ListableInputType,
  ListType,
} from './wrapping/list';
import {
  isNonNullableInputType,
  NonNullableInputType,
  NonNullableType,
} from './wrapping/non-nullable';
import {
  isNonOptionalInputType,
  NonOptionalInputType,
  NonOptionalType,
} from './wrapping/non-optional';

export * from './wrapping/list';
export * from './wrapping/non-nullable';
export * from './wrapping/non-optional';

export type WrappingInputType =
  | ListableInputType
  | NonNullableInputType
  | NonOptionalInputType;

export function isWrappingInputType(type: unknown): type is WrappingInputType {
  return (
    isListableInputType(type) ||
    isNonNullableInputType(type) ||
    isNonOptionalInputType(type)
  );
}

export function assertWrappingInputType(type: unknown): WrappingInputType {
  assert(isWrappingInputType(type), `"${type}" is not a wrapping input type`);

  return type;
}

export function getNamedInputType(type: InputType): NamedInputType {
  return isWrappingInputType(type) ? getNamedInputType(type.ofType) : type;
}

export function assertWrappingInputValue<TValue = any>(
  type: WrappingInputType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  if (type instanceof GraphQLList || type instanceof ListType) {
    return (
      maybeValue == null
        ? maybeValue
        : isIterableObject(maybeValue)
        ? Array.from(maybeValue, (maybeValue, index) =>
            assertInputValue(type.ofType, maybeValue, addPath(path, index)),
          )
        : [assertInputValue(type.ofType, maybeValue, path)]
    ) as any;
  } else if (type instanceof GraphQLNonNull) {
    if (maybeValue == null) {
      throw new UnexpectedValueError(
        maybeValue,
        `the "${type}" not to be nullish`,
        path,
      );
    }

    return assertInputValue(type.ofType, maybeValue, path);
  } else if (type instanceof NonNullableType) {
    if (maybeValue === null) {
      throw new UnexpectedValueError(
        maybeValue,
        `the non-nullable "${getNamedInputType(type)}" not to be null`,
        path,
      );
    }

    return assertInputValue(type.ofType, maybeValue, path);
  } else if (type instanceof NonOptionalType) {
    if (maybeValue === undefined) {
      throw new UnexpectedValueError(
        maybeValue,
        `the non-optional "${getNamedInputType(type)}" not to be undefined`,
        path,
      );
    }

    return assertInputValue(type.ofType, maybeValue, path);
  }

  throw new UnreachableValueError(
    type,
    `a supported wrapping input type`,
    path,
  );
}
