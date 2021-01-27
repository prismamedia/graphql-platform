import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLInputType, GraphQLList, isInputType } from 'graphql';
import { getGraphQLInputType, InputType } from '../../type';
import { AbstractWrappingInputType } from './abstract';

export class ListType<
  TType extends InputType = any,
> extends AbstractWrappingInputType<TType> {
  public get graphql(): GraphQLInputType {
    return new GraphQLList(getGraphQLInputType(this.ofType));
  }

  @Memoize()
  public toString(): string {
    return `[${this}]`;
  }
}

export type ListableInputType = GraphQLList<GraphQLInputType> | ListType;

export function isListableInputType(type: unknown): type is ListableInputType {
  return (
    (type instanceof GraphQLList && isInputType(type.ofType)) ||
    type instanceof ListType
  );
}

export function assertListableInputType(type: unknown): ListableInputType {
  assert(isListableInputType(type), `"${type}" is not a listable input type`);

  return type;
}

export function ListableInputTypeDecorator(
  type: InputType,
  listable: boolean,
): InputType {
  return isListableInputType(type) && !listable
    ? type.ofType
    : !isListableInputType(type) && listable
    ? new ListType(type)
    : type;
}
