import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLInputType, GraphQLNonNull } from 'graphql';
import { getGraphQLInputType, InputType, isInputType } from '../../type';
import { AbstractWrappingInputType } from './abstract';
import { NonOptionalType } from './non-optional';

export class NonNullableType<
  TType extends InputType = any,
> extends AbstractWrappingInputType<TType> {
  public constructor(ofType: TType) {
    super(ofType);

    if (isNonNullableInputType(ofType)) {
      return ofType as any;
    }
  }

  public get graphql(): GraphQLInputType {
    return this.ofType instanceof NonOptionalType
      ? // NonNullable & NonOptional = GraphQLNonNull
        new GraphQLNonNull(getGraphQLInputType(this.ofType.ofType))
      : getGraphQLInputType(this.ofType);
  }

  @Memoize()
  public toString(): string {
    return this.ofType instanceof NonOptionalType
      ? // NonNullable & NonOptional = GraphQLNonNull
        `${this.ofType.ofType}!`
      : String(this.ofType);
  }
}

export type NonNullableInputType =
  | GraphQLNonNull<any>
  | NonNullableType
  | NonOptionalType<NonNullableType>;

export function isNonNullableInputType(
  type: unknown,
): type is NonNullableInputType {
  return (
    (type instanceof GraphQLNonNull && isInputType(type.ofType)) ||
    type instanceof NonNullableType ||
    (type instanceof NonOptionalType && type.ofType instanceof NonNullableType)
  );
}

export function getNullableInputType(type: InputType): InputType {
  // GraphQLNonNull = NonOptional & NonNullable
  return type instanceof GraphQLNonNull
    ? new NonOptionalType(type.ofType)
    : type instanceof NonNullableType
    ? type.ofType
    : type instanceof NonOptionalType && type.ofType instanceof NonNullableType
    ? new NonOptionalType(type.ofType.ofType)
    : type;
}

export function NonNullableInputTypeDecorator(
  type: InputType,
  nonNullable: boolean,
): InputType {
  return isNonNullableInputType(type) && !nonNullable
    ? getNullableInputType(type)
    : !isNonNullableInputType(type) && nonNullable
    ? new NonNullableType(type)
    : type;
}
