import type { GraphQLInputType } from 'graphql';
import type { Path } from '../../../path.js';
import type { InputType } from '../../type.js';

export abstract class AbstractWrappingInputType {
  public constructor(public readonly ofType: InputType) {}

  public abstract toString(): string;

  public abstract getGraphQLInputType(): GraphQLInputType;

  public abstract parseValue(maybeValue: unknown, path: Path): any;
}
