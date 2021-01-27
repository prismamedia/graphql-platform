import {
  getOptionalFlag,
  OptionalFlag,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { assertValidName } from 'graphql';
import { ConnectorInterface } from '../../connector';
import { catchDefinitionError, ComponentDefinitionError } from '../../errors';
import { Model } from '../../model';

export type AbstractComponentConfig = {
  /**
   * Optional, provide a description for this component
   */
  description?: string;

  /**
   * Optional, either this component is deprecated or not
   *
   * The information will be shown in all the operations
   */
  deprecated?: boolean | string;

  /**
   * Optional, either this component is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   *
   * Default: its model's visibility
   */
  public?: OptionalFlag;

  /**
   * Optional, either this component's value can be "null" or not
   *
   * Default: false
   */
  nullable?: OptionalFlag;

  /**
   * Optional, either this component's value is immutable or not
   *
   * Default: its model's immutability
   */
  immutable?: OptionalFlag;
};

export abstract class AbstractComponent<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;
  public readonly public: boolean;
  public readonly nullable: boolean;
  public readonly immutable: boolean;

  public constructor(
    public readonly model: Model<TRequestContext, TConnector>,
    public readonly name: string,
    config: AbstractComponentConfig,
  ) {
    // name
    catchDefinitionError(
      () => assertValidName(name),
      (error) =>
        new ComponentDefinitionError(
          this,
          `expects a "name" valid against the GraphQL rules`,
          error,
        ),
    );

    // description
    this.description = config.description || undefined;

    // deprecation reason
    this.deprecationReason =
      config.deprecated === true
        ? `The "${name}" component is deprecated, it will be removed in all the operations' args and result`
        : config.deprecated || undefined;

    // public
    {
      this.public = catchDefinitionError(
        () => getOptionalFlag(config.public, model.public),
        (error) =>
          new ComponentDefinitionError(
            this,
            `expects a valid "public" value`,
            error,
          ),
      );

      if (this.public && !model.public) {
        throw new ComponentDefinitionError(
          this,
          `expects not to be "public" as the "${model}" model is not`,
        );
      }
    }

    // nullable
    this.nullable = catchDefinitionError(
      () => getOptionalFlag(config.nullable, false),
      (error) =>
        new ComponentDefinitionError(
          this,
          `expects a valid "nullable" value`,
          error,
        ),
    );

    // immutable
    {
      this.immutable = catchDefinitionError(
        () => getOptionalFlag(config.immutable, model.immutable),
        (error) =>
          new ComponentDefinitionError(
            this,
            `expects a valid "immutable" value`,
            error,
          ),
      );

      if (!this.immutable && model.immutable) {
        throw new ComponentDefinitionError(
          this,
          `expects to be immutable as the "${model}" model is`,
        );
      }
    }
  }

  @Memoize()
  public toString(): string {
    return `${this.model.name}.${this.name}`;
  }

  @Memoize()
  public get unique(): boolean {
    return [...this.model.uniqueConstraintMap.values()].some(
      (uniqueConstraint) =>
        uniqueConstraint.componentSet.size === 1 &&
        uniqueConstraint.componentSet.has(this as any),
    );
  }

  public validate(): void {
    // Resolves the "lazy" properties
    this.unique;
  }
}
