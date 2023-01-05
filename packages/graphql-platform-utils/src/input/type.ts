import * as graphql from 'graphql';
import { UnexpectedValueError } from '../error.js';
import type { Path } from '../path.js';
import {
  getGraphQLNamedInputType,
  isNamedInputType,
  isNamedInputTypePublic,
  NamedInputType,
  parseNamedInputLiteral,
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
  path?: Path,
): asserts maybeInputType is InputType {
  if (!isInputType(maybeInputType)) {
    throw new UnexpectedValueError(`an input type`, maybeInputType, { path });
  }
}

export function ensureInputType(
  maybeInputType: unknown,
  path?: Path,
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
  value: unknown,
  path?: Path,
): any {
  return isNamedInputType(type)
    ? parseNamedInputValue(type, value, path)
    : type.parseValue(value, path);
}

export type NonNullNonVariableGraphQLValueNode = Exclude<
  graphql.ValueNode,
  graphql.NullValueNode | graphql.VariableNode
>;

export function parseInputLiteral(
  type: InputType,
  value: graphql.ValueNode,
  variableValues?: graphql.GraphQLResolveInfo['variableValues'],
  path?: Path,
): any {
  if (value.kind === graphql.Kind.NULL) {
    return parseInputValue(type, null, path);
  } else if (value.kind === graphql.Kind.VARIABLE) {
    return parseInputValue(type, variableValues?.[value.name.value], path);
  }

  return isNamedInputType(type)
    ? parseNamedInputLiteral(type, value, variableValues, path)
    : type.parseLiteral(value, variableValues, path);
}

export function getNamedInputType(inputType: InputType): NamedInputType {
  return isWrappingInputType(inputType)
    ? getNamedInputType(inputType.ofType)
    : inputType;
}
