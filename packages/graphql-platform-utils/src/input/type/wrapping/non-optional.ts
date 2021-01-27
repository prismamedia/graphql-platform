import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLInputType, GraphQLNonNull } from 'graphql';
import { getGraphQLInputType, InputType, isInputType } from '../../type';
import { AbstractWrappingInputType } from './abstract';
import { NonNullableType } from './non-nullable';

export class NonOptionalType<
  TType extends InputType = any,
> extends AbstractWrappingInputType<TType> {
  public constructor(ofType: TType) {
    super(ofType);

    if (isNonOptionalInputType(ofType)) {
      return ofType as any;
    }
  }

  public get graphql(): GraphQLInputType {
    return this.ofType instanceof NonNullableType
      ? // NonNullable & NonOptional = GraphQLNonNull
        new GraphQLNonNull(getGraphQLInputType(this.ofType.ofType))
      : getGraphQLInputType(this.ofType);
  }

  @Memoize()
  public toString(): string {
    return this.ofType instanceof NonNullableType
      ? // NonOptional & NonNullable = GraphQLNonNull
        `${this.ofType.ofType}!`
      : String(this.ofType);
  }
}

export type NonOptionalInputType =
  | GraphQLNonNull<any>
  | NonOptionalType
  | NonNullableType<NonOptionalType>;

export function isNonOptionalInputType(
  type: unknown,
): type is NonOptionalInputType {
  return (
    (type instanceof GraphQLNonNull && isInputType(type.ofType)) ||
    type instanceof NonOptionalType ||
    (type instanceof NonNullableType && type.ofType instanceof NonOptionalType)
  );
}

export function getOptionalInputType(type: InputType): InputType {
  // GraphQLNonNull = NonOptional & NonNullable
  return type instanceof GraphQLNonNull
    ? new NonNullableType(type.ofType)
    : type instanceof NonOptionalType
    ? type.ofType
    : type instanceof NonNullableType && type.ofType instanceof NonOptionalType
    ? new NonNullableType(type.ofType.ofType)
    : type;
}

export function NonOptionalInputTypeDecorator(
  type: InputType,
  nonOptional: boolean,
): InputType {
  return isNonOptionalInputType(type) && !nonOptional
    ? getOptionalInputType(type)
    : !isNonOptionalInputType(type) && nonOptional
    ? new NonOptionalType(type)
    : type;
}
