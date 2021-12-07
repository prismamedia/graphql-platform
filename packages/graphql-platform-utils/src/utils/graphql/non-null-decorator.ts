import { GraphQLNonNull, GraphQLNullableType } from 'graphql';

export function GraphQLNonNullDecorator<
  T extends GraphQLNullableType,
  B extends boolean,
>(type: T, isNonNull: B): B extends true ? GraphQLNonNull<T> : T {
  return (isNonNull === true ? GraphQLNonNull(type) : type) as any;
}
