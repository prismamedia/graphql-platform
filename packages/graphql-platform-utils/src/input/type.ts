import assert from 'assert';
import { GraphQLInputType, isInputType as isGraphQLInputType } from 'graphql';
import { Path } from '../path';
import {
  assertNamedInputValue,
  isNamedInputType,
  NamedInputType,
} from './type/named';
import {
  assertWrappingInputValue,
  isWrappingInputType,
  WrappingInputType,
} from './type/wrapping';

export * from './type/named';
export * from './type/wrapping';

export type InputType = NamedInputType | WrappingInputType;

export function isInputType(type: unknown): type is InputType {
  return isNamedInputType(type) || isWrappingInputType(type);
}

export function assertInputType(type: unknown): InputType {
  assert(isInputType(type), `"${type}" is not an input type`);

  return type;
}

export function getGraphQLInputType(type: InputType): GraphQLInputType {
  return isGraphQLInputType(type) ? type : type.graphql;
}

export function assertInputValue<TValue = any>(
  type: InputType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  return isNamedInputType(type)
    ? assertNamedInputValue(type, maybeValue, path)
    : assertWrappingInputValue(type, maybeValue, path);
}
