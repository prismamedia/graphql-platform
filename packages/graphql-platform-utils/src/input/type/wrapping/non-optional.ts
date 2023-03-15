import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { UnexpectedUndefinedError } from '../../../error.js';
import type { Path } from '../../../path.js';
import {
  getGraphQLInputType,
  NonNullNonVariableGraphQLValueNode,
  parseInputLiteral,
  parseInputValue,
  type InputType,
} from '../../type.js';
import { AbstractWrappingInputType } from './abstract.js';
import { NonNullableInputType } from './non-nullable.js';

/**
 * GraphQL makes no difference between "!= null" and "!= undefined": a "GraphQLNonNull" field must be "!= null" AND "!= undefined"
 *
 * The "NonOptionalType" only ensure the "!= undefined"
 */
export class NonOptionalInputType extends AbstractWrappingInputType {
  public constructor(ofType: InputType) {
    super(ofType);

    if (isNonOptionalInputType(ofType)) {
      return ofType as any;
    }
  }

  @Memoize()
  public toString(): string {
    return this.ofType instanceof NonNullableInputType
      ? // NonOptional & NonNullable = GraphQLNonNull
        `${this.ofType.ofType}!`
      : String(this.ofType);
  }

  public getGraphQLInputType(): graphql.GraphQLInputType {
    return this.ofType instanceof NonNullableInputType
      ? // NonNullable & NonOptional = GraphQLNonNull
        new graphql.GraphQLNonNull(getGraphQLInputType(this.ofType.ofType))
      : getGraphQLInputType(this.ofType);
  }

  public override parseValue(value: unknown, path?: Path): any {
    const wrappedValue = parseInputValue(this.ofType, value, path);

    if (wrappedValue === undefined) {
      throw new UnexpectedUndefinedError(this.ofType, {
        path,
      });
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

    if (wrappedValue === undefined) {
      throw new UnexpectedUndefinedError(this.ofType, {
        path,
      });
    }

    return wrappedValue;
  }
}

export function isNonOptionalInputType(type: unknown): boolean {
  return (
    type instanceof NonOptionalInputType ||
    (type instanceof NonNullableInputType &&
      type.ofType instanceof NonOptionalInputType)
  );
}

export function getOptionalInputType(type: InputType): InputType {
  return type instanceof NonOptionalInputType
    ? type.ofType
    : type instanceof NonNullableInputType &&
      type.ofType instanceof NonOptionalInputType
    ? new NonNullableInputType(type.ofType.ofType)
    : type;
}

export function nonOptionalInputTypeDecorator(
  type: InputType,
  nonOptional: boolean,
): InputType {
  return isNonOptionalInputType(type) && !nonOptional
    ? getOptionalInputType(type)
    : !isNonOptionalInputType(type) && nonOptional
    ? new NonOptionalInputType(type)
    : type;
}

export type Optional<T> = T | undefined;

export type NonOptional<T> = Exclude<T, undefined>;
