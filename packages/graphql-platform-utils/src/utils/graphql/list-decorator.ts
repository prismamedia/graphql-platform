import { GraphQLList, GraphQLType } from 'graphql';

export function GraphQLListDecorator<T extends GraphQLType, B extends boolean>(
  type: T,
  isList: B,
): B extends true ? GraphQLList<T> : T {
  return (isList === true ? GraphQLList(type) : type) as any;
}
