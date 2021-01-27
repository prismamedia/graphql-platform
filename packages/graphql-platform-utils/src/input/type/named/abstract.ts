import { assertValidName, GraphQLInputType, GraphQLNamedType } from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';

export interface AbstractNamedInputTypeConfig {
  /**
   * Required, this input's name
   */
  name: string;

  /**
   * Optional, provide a description
   */
  description?: Maybe<string>;
}

export abstract class AbstractNamedInputType {
  public readonly name: string;
  public readonly description: string | undefined;

  public constructor(config: AbstractNamedInputTypeConfig) {
    this.name = assertValidName(config.name);
    this.description = config.description || undefined;
  }

  public abstract get graphql(): Extract<GraphQLNamedType, GraphQLInputType>;

  public toString(): string {
    return this.name;
  }

  public toJSON(): string {
    return this.toString();
  }
}
