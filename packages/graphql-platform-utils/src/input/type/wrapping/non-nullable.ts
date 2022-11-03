import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import { UnexpectedNullError } from '../../../error.js';
import { type Path } from '../../../path.js';
import { getGraphQLInputType, InputType, parseInputValue } from '../../type.js';
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

  public parseValue(maybeValue: unknown, path?: Path): any {
    const wrappedValue = parseInputValue(this.ofType, maybeValue, path);

    if (wrappedValue === null) {
      throw new UnexpectedNullError(`"${this.ofType}"`, { path });
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
