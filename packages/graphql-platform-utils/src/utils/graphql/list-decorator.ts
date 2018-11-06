import { GraphQLList, GraphQLNonNull, GraphQLType } from 'graphql';

export function GraphQLListDecorator<T extends GraphQLType, B extends boolean>(
  type: T,
  isList: B,
): B extends true ? T : GraphQLNonNull<T> {
  return (isList === true ? GraphQLList(type) : type) as any;
}
