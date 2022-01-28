import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import { aggregateError } from '../../../error.js';
import { isIterableObject } from '../../../is-iterable-object.js';
import { isNil, type Nillable } from '../../../nil.js';
import { addPath, type Path } from '../../../path.js';
import { getGraphQLInputType, InputType, parseInputValue } from '../../type.js';
import { AbstractWrappingInputType } from './abstract.js';

export class ListableInputType extends AbstractWrappingInputType {
  @Memoize()
  public toString(): string {
    return `[${this.ofType}]`;
  }

  public getGraphQLInputType(): graphql.GraphQLInputType {
    return new graphql.GraphQLList(getGraphQLInputType(this.ofType));
  }

  public parseValue(maybeValue: unknown, path?: Path): Nillable<any[]> {
    if (isNil(maybeValue)) {
      return maybeValue;
    }

    return isIterableObject(maybeValue)
      ? aggregateError<any, any[]>(
          maybeValue,
          (values, maybeValue, index) => [
            ...values,
            parseInputValue(this.ofType, maybeValue, addPath(path, index)),
          ],
          [],
          { path },
        )
      : [parseInputValue(this.ofType, maybeValue, path)];
  }
}

export function ListableInputTypeDecorator(
  type: InputType,
  listable: boolean,
): InputType {
  return type instanceof ListableInputType && !listable
    ? type.ofType
    : !(type instanceof ListableInputType) && listable
    ? new ListableInputType(type)
    : type;
}
