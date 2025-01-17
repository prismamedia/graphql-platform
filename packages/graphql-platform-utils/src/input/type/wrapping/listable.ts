import { MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { aggregateGraphError } from '../../../error.js';
import { isIterableObject } from '../../../is-iterable-object.js';
import { isNil, type Nillable } from '../../../nil.js';
import { addPath, type Path } from '../../../path.js';
import {
  areInputValuesEqual,
  getGraphQLInputType,
  parseInputLiteral,
  parseInputValue,
  type InputType,
  type NonNullNonVariableGraphQLValueNode,
} from '../../type.js';
import { AbstractWrappingInputType } from './abstract.js';

export class ListableInputType extends AbstractWrappingInputType {
  @MMethod()
  public toString(): string {
    return `[${this.ofType}]`;
  }

  public getGraphQLInputType(): graphql.GraphQLInputType {
    return new graphql.GraphQLList(getGraphQLInputType(this.ofType));
  }

  public override parseValue(value: unknown, path?: Path): Nillable<any[]> {
    if (isNil(value)) {
      return value;
    }

    return isIterableObject(value)
      ? aggregateGraphError<any, any[]>(
          value,
          (values, maybeValue, index) => {
            values.push(
              parseInputValue(this.ofType, maybeValue, addPath(path, index)),
            );

            return values;
          },
          [],
          { path },
        )
      : [parseInputValue(this.ofType, value, path)];
  }

  public override parseLiteral(
    value: NonNullNonVariableGraphQLValueNode,
    variableValues?: graphql.GraphQLResolveInfo['variableValues'],
    path?: Path,
  ): Nillable<any[]> {
    return value.kind === graphql.Kind.LIST
      ? aggregateGraphError<graphql.ValueNode, any[]>(
          value.values,
          (values, value, index) => {
            values.push(
              parseInputLiteral(
                this.ofType,
                value,
                variableValues,
                addPath(path, index),
              ),
            );

            return values;
          },
          [],
          { path },
        )
      : [parseInputLiteral(this.ofType, value, variableValues, path)];
  }

  public areValuesEqual(a: unknown, b: unknown): boolean {
    return a == null || b == null
      ? a === b
      : Array.isArray(a) &&
          Array.isArray(b) &&
          a.length === b.length &&
          a.every((value, index) =>
            areInputValuesEqual(this.ofType, value, b[index]),
          );
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
