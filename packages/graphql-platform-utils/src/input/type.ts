import * as graphql from 'graphql';
import { UnexpectedConfigError } from '../error.js';
import { Path } from '../path.js';
import {
  getGraphQLNamedInputType,
  isNamedInputType,
  isNamedInputTypePublic,
  NamedInputType,
  parseNamedInputValue,
  validateNamedInputType,
} from './type/named.js';
import { isWrappingInputType, WrappingInputType } from './type/wrapping.js';

export * from './type/named.js';
export * from './type/wrapping.js';

export type InputType = NamedInputType | WrappingInputType;

export function isInputType(
  maybeInputType: unknown,
): maybeInputType is InputType {
  return (
    isNamedInputType(maybeInputType) || isWrappingInputType(maybeInputType)
  );
}

export function assertInputType(
  maybeInputType: unknown,
  path: Path,
): asserts maybeInputType is InputType {
  if (!isInputType(maybeInputType)) {
    throw new UnexpectedConfigError(`an input type`, maybeInputType, { path });
  }
}

export function ensureInputType(
  maybeInputType: unknown,
  path: Path,
): InputType {
  assertInputType(maybeInputType, path);

  return maybeInputType;
}

export function isInputTypePublic(type: InputType): boolean {
  return isNamedInputType(type)
    ? isNamedInputTypePublic(type)
    : isInputTypePublic(type.ofType);
}

export function validateInputType(type: InputType): void {
  isNamedInputType(type)
    ? validateNamedInputType(type)
    : validateInputType(type.ofType);
}

export function getGraphQLInputType(type: InputType): graphql.GraphQLInputType {
  return isNamedInputType(type)
    ? getGraphQLNamedInputType(type)
    : type.getGraphQLInputType();
}

export function parseInputValue(
  type: InputType,
  maybeValue: unknown,
  path?: Path,
): any {
  return isNamedInputType(type)
    ? parseNamedInputValue(type, maybeValue, path)
    : type.parseValue(maybeValue, path);
}

export function getNamedInputType(inputType: InputType): NamedInputType {
  return isWrappingInputType(inputType)
    ? getNamedInputType(inputType.ofType)
    : inputType;
}
