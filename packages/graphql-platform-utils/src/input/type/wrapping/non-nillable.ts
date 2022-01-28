import { InputType } from '../../type.js';
import {
  getNullableInputType,
  isNonNullableInputType,
  NonNullableInputType,
} from './non-nullable.js';
import {
  getOptionalInputType,
  isNonOptionalInputType,
  NonOptionalInputType,
} from './non-optional.js';

export const isNonNillableInputType = (type: unknown) =>
  isNonOptionalInputType(type) && isNonNullableInputType(type);

export const nonNillableInputType = (type: InputType): InputType =>
  new NonNullableInputType(new NonOptionalInputType(type));

export function getNillableInputType(type: InputType): InputType {
  return getOptionalInputType(getNullableInputType(type));
}

export function nonNillableInputTypeDecorator(
  type: InputType,
  nonNillable: boolean,
): InputType {
  return isNonNillableInputType(type) && !nonNillable
    ? getNillableInputType(type)
    : !isNonNillableInputType(type) && nonNillable
    ? nonNillableInputType(type)
    : type;
}
