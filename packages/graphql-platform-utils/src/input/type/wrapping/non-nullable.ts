import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { UnexpectedNullError } from '../../../error.js';
import type { Path } from '../../../path.js';
import {
  getGraphQLInputType,
  parseInputLiteral,
  parseInputValue,
  type InputType,
  type NonNullNonVariableGraphQLValueNode,
} from '../../type.js';
import { AbstractWrappingInputType } from './abstract.js';
import { NonOptionalInputType } from './non-optional.js';

/**
 * GraphQL makes no difference between "!= null" and "!= undefined": a "GraphQLNonNull" field must be "!= null" AND "!= undefined"
 *
 * The "NonNullableType" only ensure the "!= null"
 */
export class NonNullableInputType extends AbstractWrappingInputType {
  public constructor(ofType: InputType) {
    super(ofType);

    if (isNonNullableInputType(ofType)) {
      return ofType as any;
    }
  }

  @Memoize()
  public toString(): string {
    return this.ofType instanceof NonOptionalInputType
      ? // NonNullable & NonOptional = GraphQLNonNull
        `${this.ofType.ofType}!`
      : String(this.ofType);
  }

  public getGraphQLInputType(): graphql.GraphQLInputType {
    return this.ofType instanceof NonOptionalInputType
      ? // NonNullable & NonOptional = GraphQLNonNull
        new graphql.GraphQLNonNull(getGraphQLInputType(this.ofType.ofType))
      : getGraphQLInputType(this.ofType);
  }

  public override parseValue(value: unknown, path?: Path): any {
    const wrappedValue = parseInputValue(this.ofType, value, path);

    if (wrappedValue === null) {
      throw new UnexpectedNullError(this.ofType, { path });
    }

    return wrappedValue;
  }

  public override parseLiteral(
    value: NonNullNonVariableGraphQLValueNode,
    variableValues?: graphql.GraphQLResolveInfo['variableValues'],
    path?: Path,
  ): any {
    const wrappedValue = parseInputLiteral(
      this.ofType,
      value,
      variableValues,
      path,
    );

    if (wrappedValue === null) {
      throw new UnexpectedNullError(this.ofType, { path });
    }

    return wrappedValue;
  }
}

export function isNonNullableInputType(type: unknown): boolean {
  return (
    type instanceof NonNullableInputType ||
    (type instanceof NonOptionalInputType &&
      type.ofType instanceof NonNullableInputType)
  );
}

export function getNullableInputType(type: InputType): InputType {
  return type instanceof NonNullableInputType
    ? type.ofType
    : type instanceof NonOptionalInputType &&
      type.ofType instanceof NonNullableInputType
    ? new NonOptionalInputType(type.ofType.ofType)
    : type;
}

export function nonNullableInputTypeDecorator(
  type: InputType,
  nonNullable: boolean,
): InputType {
  return isNonNullableInputType(type) && !nonNullable
    ? getNullableInputType(type)
    : !isNonNullableInputType(type) && nonNullable
    ? new NonNullableInputType(type)
    : type;
}
