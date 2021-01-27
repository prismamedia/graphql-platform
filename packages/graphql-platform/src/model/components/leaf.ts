import {
  isScalarType,
  isScalarTypeName,
  Scalars,
  ScalarType,
  scalarTypeNames,
} from '@prismamedia/graphql-platform-scalars';
import { OptionalFlag } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLEnumType, GraphQLLeafType, isEnumType } from 'graphql';
import {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../../connector';
import { ComponentDefinitionError } from '../../errors';
import { Model } from '../../model';
import { LeafInputFieldConfig as CreationInputFieldConfig } from '../types/inputs/creation';
import { LeafInputFieldConfig as UpdateInputFieldConfig } from '../types/inputs/update';
import { LeafField, LeafFieldSelection } from '../types/node';
import { AbstractComponent, AbstractComponentConfig } from './abstract';

export type LeafType = ScalarType | GraphQLEnumType;

export type LeafValue = null | ReturnType<LeafType['parseValue']>;

export type LeafConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = AbstractComponentConfig & {
  kind: 'Leaf';

  /**
   * Required, a native "Enum" or "Scalar" instance or a supported "Scalar"'s name
   *
   * ex: { type: "UUID" }
   */
  type: ScalarType['name'] | ScalarType | GraphQLLeafType;

  /**
   * Optional, fine-tune the "inputs"
   */
  inputs?:
    | any
    | {
        /**
         * Optional, either the nodes can be sorted using this leaf's value or not
         *
         * Default: guessed from its type
         */
        sortable?: OptionalFlag;

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
} & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.Leaf>;

export class Leaf<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TRequestContext, TConnector> {
  public readonly type: LeafType;

  public constructor(
    model: Model<TRequestContext, TConnector>,
    name: string,
    public readonly config: LeafConfig<TRequestContext, TConnector>,
  ) {
    super(model, name, config);

    if (config.kind !== 'Leaf') {
      throw new ComponentDefinitionError(
        this,
        `expects the "kind" to be "Leaf", got "${config.kind}"`,
      );
    }

    if (isScalarTypeName(config.type)) {
      this.type = Scalars[config.type];
    } else if (isScalarType(config.type)) {
      this.type = config.type;
    } else if (isEnumType(config.type)) {
      this.type = config.type;
    } else {
      throw new ComponentDefinitionError(
        this,
        `expects the "type" to be an Enum or a Scalar among "${scalarTypeNames.join(
          ', ',
        )}"`,
      );
    }
  }

  @Memoize()
  public get selection(): LeafFieldSelection {
    const leafField = [...this.model.nodeType.fieldMap.values()].find(
      (field): field is LeafField =>
        field instanceof LeafField && field.leaf === this,
    )!;

    return leafField.selection;
  }
}
