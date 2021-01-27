import { GraphQLInputType } from 'graphql';
import { assertInputType, InputType } from '../../type';

export abstract class AbstractWrappingInputType<TType extends InputType = any> {
  public constructor(public readonly ofType: TType) {
    assertInputType(ofType);
  }

  public abstract get graphql(): GraphQLInputType;

  public abstract toString(): string;

  public toJSON(): string {
    return this.toString();
  }
}
