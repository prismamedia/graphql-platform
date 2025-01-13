import type * as graphql from 'graphql';
import type { Path } from '../../../path.js';
import type {
  InputType,
  NonNullNonVariableGraphQLValueNode,
} from '../../type.js';

export abstract class AbstractWrappingInputType {
  public constructor(public readonly ofType: InputType) {}

  public abstract toString(): string;

  public abstract getGraphQLInputType(): graphql.GraphQLInputType;

  public abstract parseValue(value: unknown, path?: Path): any;

  public abstract parseLiteral(
    value: NonNullNonVariableGraphQLValueNode,
    variableValues?: graphql.GraphQLResolveInfo['variableValues'],
    path?: Path,
  ): any;

  public abstract areValuesEqual(a: unknown, b: unknown): boolean;
}
