import {
  getOptionalFlag,
  OptionalFlag,
} from '@prismamedia/graphql-platform-utils';
import { assertValidName } from 'graphql';
import { ConnectorInterface } from '../connector';
import { catchDefinitionError, ReferrerDefinitionError } from '../errors';
import { Model } from '../model';
import { Reference } from './components';
import { ReverseEdgeInputFieldConfig as CreationInputFieldConfig } from './types/inputs/creation';
import { ReverseEdgeInputFieldConfig as UpdateInputFieldConfig } from './types/inputs/update';

type FullReferrerConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = {
  /**
   * Required, the model's name having a reference to this model, ex: { referrer: "Article" }
   *
   * Optional, specify the reference's name after a ".", ex: { referrer: "Article.category" }
   */
  referrer: Model['name'] | `${Model['name']}.${Reference['name']}`;

  /**
   * Optional, either this referrer is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   *
   * Default: its original reference's visibility
   */
  public?: OptionalFlag;

  /**
   * Optional, provide a description for this referrer
   */
  description?: string;

  /**
   * Optional, either this referrer is deprecated or not
   *
   * The information will be shown in all the operations
   */
  deprecated?: boolean | string;

  /**
   * Optional, fine-tune the corresponding inputs
   */
  inputs?:
    | any
    | {
        /**
         * Optional, fine-tune the creation input
         */
        creation?: CreationInputFieldConfig;

        /**
         * Optional, fine-tune the updating input
         */
        update?: UpdateInputFieldConfig;
      };
};

type ShortReferrerConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = FullReferrerConfig<TRequestContext, TConnector>['referrer'];

export type ReferrerConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> =
  | FullReferrerConfig<TRequestContext, TConnector>
  | ShortReferrerConfig<TRequestContext, TConnector>;

const isShortConfig = <TRequestContext, TConnector extends ConnectorInterface>(
  config: ReferrerConfig<TRequestContext, TConnector>,
): config is ShortReferrerConfig<TRequestContext, TConnector> =>
  typeof config === 'string';

export class Referrer<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly id: string;
  public readonly config: FullReferrerConfig<TRequestContext, TConnector>;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;
  public readonly originalReference: Reference<TRequestContext, TConnector>;
  public readonly public: boolean;
  public readonly unique: boolean;

  public constructor(
    public readonly model: Model<TRequestContext, TConnector>,
    public readonly name: string,
    config: ReferrerConfig<TRequestContext, TConnector>,
  ) {
    this.id = `${model.name}.${name}`;

    // name
    catchDefinitionError(
      () => assertValidName(name),
      (error) =>
        new ReferrerDefinitionError(
          this,
          `expects a "name" valid against the GraphQL rules`,
          error,
        ),
    );

    // config
    this.config = isShortConfig(config) ? { referrer: config } : config;

    // description
    this.description = this.config.description || undefined;

    // deprecation reason
    this.deprecationReason =
      this.config.deprecated === true
        ? `The "${name}" referrer is deprecated, it will be removed in all the operations' args and result`
        : this.config.deprecated || undefined;

    // original reference
    {
      if (typeof this.config.referrer !== 'string' || !this.config.referrer) {
        throw new ReferrerDefinitionError(
          this,
          `expects a "referrer" provided as a non-empty string`,
        );
      }

      const [originalModelName, originalReferenceName] =
        this.config.referrer.split('.');

      const originalModel = catchDefinitionError(
        () => model.gp.getModel(originalModelName),
        () =>
          new ReferrerDefinitionError(
            this,
            `expects the "referrer"'s original model to be among "${[
              ...model.gp.modelMap.keys(),
            ].join(', ')}", got "${originalModelName}"`,
          ),
      );

      this.originalReference = catchDefinitionError(
        () => originalModel.getReference(originalReferenceName),
        () =>
          new ReferrerDefinitionError(
            this,
            `expects the "referrer"'s original reference to be among "${[
              ...originalModel.referenceMap.keys(),
            ].join(', ')}", got "${originalReferenceName}"`,
          ),
      );

      if (this.originalReference.model !== model) {
        throw new ReferrerDefinitionError(
          this,
          `expects the "referrer"'s original reference referring this "${model}" model, got "${this.originalReference.model}"`,
        );
      }
    }

    // unique
    {
      this.unique = this.originalReference.unique;
    }

    // public
    {
      this.public = catchDefinitionError(
        () => getOptionalFlag(this.config.public, model.public),
        (error) =>
          new ReferrerDefinitionError(
            this,
            `expects a valid "public" value`,
            error,
          ),
      );

      if (this.public && !model.public) {
        throw new ReferrerDefinitionError(
          this,
          `expects not to be "public" as the "${model}" model is not`,
        );
      }
    }
  }

  public toString(): string {
    return this.id;
  }
}
