import type * as graphql from 'graphql';
import {
  ensureName,
  getOptionalDescription,
  type Name,
  type OptionalDescription,
} from '../../../config.js';
import type { Nillable } from '../../../nil.js';
import { addPath, type Path } from '../../../path.js';
import type { NonNullNonVariableGraphQLValueNode } from '../../type.js';

export interface AbstractNamedInputTypeConfig {
  /**
   * Required, this input's name
   */
  name: Name;

  /**
   * Optional, provide a useful description
   */
  description?: OptionalDescription;
}

export abstract class AbstractNamedInputType<TValue = any> {
  public readonly name: Name;
  public readonly description?: string;

  public constructor(
    config: AbstractNamedInputTypeConfig,
    configPath: Path = addPath(undefined, config.name),
  ) {
    // name
    {
      const nameConfig = config.name;
      const nameConfigPath = addPath(configPath, 'name');

      this.name = ensureName(nameConfig, nameConfigPath);
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = addPath(configPath, 'description');

      this.description = getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }
  }

  public toString(): string {
    return this.name;
  }

  public abstract isPublic(): boolean;

  public abstract getGraphQLInputType(): Extract<
    graphql.GraphQLNamedType,
    graphql.GraphQLInputType
  >;

  public abstract validate(): void;

  public abstract parseValue(value: unknown, path?: Path): Nillable<TValue>;

  public abstract parseLiteral(
    value: NonNullNonVariableGraphQLValueNode,
    variableValues?: graphql.GraphQLResolveInfo['variableValues'],
    path?: Path,
  ): Nillable<TValue>;
}
