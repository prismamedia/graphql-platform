import { Memoize } from '@prismamedia/ts-memoize';
import {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../../connector';
import { catchDefinitionError, ComponentDefinitionError } from '../../errors';
import { Model } from '../../model';
import { ComponentValue } from '../components';
import { EdgeInputFieldConfig as CreationInputFieldConfig } from '../types/inputs/creation';
import { EdgeInputFieldConfig as UpdateInputFieldConfig } from '../types/inputs/update';
import { EdgeField, EdgeFieldSelection } from '../types/node';
import { UniqueConstraint } from '../unique-constraint';
import { AbstractComponent, AbstractComponentConfig } from './abstract';

export type ReferenceValue = null | {
  [componentName: string]: ComponentValue;
};

export type ReferenceConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = AbstractComponentConfig & {
  kind: 'Reference';

  /**
   * Required, the referenced "model"'s name, ex: { kind: "Reference", type: "Category" }
   *
   * Optional, specify the referenced "unique constraint"'s name after a ".", ex: { kind: "Reference", type: "Category.parent-title" }
   *
   * Default: the referenced "model"'s identifier (= its first "unique constraint")
   */
  type: Model['name'] | `${Model['name']}.${UniqueConstraint['name']}`;

  /**
   * Optional, fine-tune the "inputs"
   */
  inputs?:
    | any
    | {
        /**
         * Optional, fine-tune the "creation" input
         *
         * "null" means the value cannot be provided at creation
         */
        creation?: CreationInputFieldConfig<TRequestContext, TConnector> | null;

        /**
         * Optional, fine-tune the "update" input
         *
         * "null" means the value cannot be updated
         */
        update?: UpdateInputFieldConfig<TRequestContext, TConnector> | null;
      };
} & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.Reference>;

export class Reference<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TRequestContext, TConnector> {
  public constructor(
    model: Model<TRequestContext, TConnector>,
    name: string,
    public readonly config: ReferenceConfig<TRequestContext, TConnector>,
  ) {
    super(model, name, config);

    if (config.kind !== 'Reference') {
      throw new ComponentDefinitionError(
        this,
        `expects the "kind" to be "Reference", got "${config.kind}"`,
      );
    }

    if (typeof config.type !== 'string' || !config.type) {
      throw new ComponentDefinitionError(
        this,
        `expects a "type" provided as a non-empty string`,
      );
    }
  }

  @Memoize()
  public get referencedUniqueConstraint(): UniqueConstraint<
    TRequestContext,
    TConnector
  > {
    const [referencedModelName, referencedUniqueConstraintName] =
      this.config.type.split('.');

    const referencedModel = catchDefinitionError(
      () => this.model.gp.getModel(referencedModelName),
      () =>
        new ComponentDefinitionError(
          this,
          `expects a referenced "model"'s name among "${[
            ...this.model.gp.modelMap.keys(),
          ].join(', ')}", got "${referencedModelName}"`,
        ),
    );

    const referencedUniqueConstraint = referencedUniqueConstraintName
      ? catchDefinitionError(
          () =>
            referencedModel.getUniqueConstraint(
              referencedUniqueConstraintName!,
            ),
          () =>
            new ComponentDefinitionError(
              this,
              `expects a referenced "unique constraint"'s name among "${[
                ...referencedModel.uniqueConstraintMap.keys(),
              ].join(', ')}", got "${referencedUniqueConstraintName}"`,
            ),
        )
      : referencedModel.identifier;

    if (
      [...referencedUniqueConstraint.componentSet].some(
        (component) => component instanceof Reference && component === this,
      )
    ) {
      throw new ComponentDefinitionError(
        this,
        `expects a "reference" not refering itself`,
      );
    }

    return referencedUniqueConstraint;
  }

  @Memoize()
  public get selection(): EdgeFieldSelection {
    const edgeField = [...this.model.nodeType.fieldMap.values()].find(
      (field): field is EdgeField =>
        field instanceof EdgeField && field.reference === this,
    )!;

    return new EdgeFieldSelection(
      edgeField,
      this.referencedUniqueConstraint.selection,
    );
  }
}
