import {
  bigintScalarTypes,
  booleanScalarTypes,
  DateScalarTypes,
  isScalarTypeAmong,
  isScalarTypeName,
  numberScalarTypes,
  primitiveScalarTypes,
  scalarTypeByName as Scalars,
  scalarTypeNames,
  TScalarType,
} from '@prismamedia/graphql-platform-scalars';
import {
  getOptionalFlagValue,
  OptionalFlagValue,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLEnumType, isEnumType } from 'graphql';
import {
  IConnector,
  TConnectorOverridesKind,
  TGetConnectorOverrides,
} from '../../connector';
import { Node } from '../../node';
import { ICreateLeafInputFieldConfig } from '../../operations/mutations/create';
import { ILeafSelection } from '../fields';
import {
  isLeafFilterOperatorAmong,
  TLeafFilterOperator,
} from '../where-input/ast';
import { AbstractComponent, IComponentConfig } from './abstract';

export { scalarTypeByName as Scalars } from '@prismamedia/graphql-platform-scalars';

export type TLeafType = GraphQLEnumType | TScalarType;

export type TLeafValue = null | ReturnType<TLeafType['parseValue']>;

export type TLeafConfig<
  TContext,
  TConnector extends IConnector
> = IComponentConfig<'Leaf'> & {
  /**
   * Required, the output type is an "Enum" or a supported "Scalar"
   */
  type: GraphQLEnumType | TScalarType['name'];

  /**
   * Optional, fine-tune the inputs related to this leaf
   */
  inputs?: {
    /**
     * Optional, either the node can be filtered using this leaf's value or not
     *
     * Default: guessed from the type
     */
    filterable?: boolean | ReadonlyArray<TLeafFilterOperator>;

    /**
     * Optional, either the node can be sorted using this leaf's value or not
     *
     * Default: guessed from the type
     */
    sortable?: OptionalFlagValue;

    /**
     * Optional, fine-tune the leaf's input field for creating a node record
     */
    create?: ICreateLeafInputFieldConfig;
  };
} & TGetConnectorOverrides<TConnector, TConnectorOverridesKind.Leaf>;

export class Leaf<
  TConnector extends IConnector = any
> extends AbstractComponent {
  public readonly type: TLeafType;

  public constructor(
    node: Node,
    name: string,
    public readonly config: TLeafConfig<any, TConnector>,
  ) {
    super(node, name, config);

    if (isScalarTypeName(config.type)) {
      this.type = Scalars[config.type];
    } else if (isEnumType(config.type)) {
      this.type = config.type;
    } else {
      throw new Error(
        `The "${
          this.id
        }" leaf expects an Enum or a Scalar among: ${scalarTypeNames.join(
          ', ',
        )}`,
      );
    }
  }

  @Memoize((operator: TLeafFilterOperator) => operator)
  public isFilterableWith(operator: TLeafFilterOperator): boolean {
    const filterable = this.config.inputs?.filterable;

    return typeof filterable === 'boolean'
      ? filterable
      : Array.isArray(filterable)
      ? filterable.includes(operator)
      : isLeafFilterOperatorAmong(operator, ['eq', 'not', 'in', 'not_in'])
      ? isEnumType(this.type) ||
        isScalarTypeAmong(this.type, [
          ...primitiveScalarTypes,
          ...DateScalarTypes,
          Scalars.URL,
        ])
      : isLeafFilterOperatorAmong(operator, ['gt', 'gte', 'lt', 'lte'])
      ? isScalarTypeAmong(this.type, [
          ...bigintScalarTypes,
          ...DateScalarTypes,
          ...numberScalarTypes,
        ])
      : false;
  }

  @Memoize()
  public get sortable(): boolean {
    return getOptionalFlagValue(
      this.config.inputs?.sortable,
      isScalarTypeAmong(this.type, [
        ...bigintScalarTypes,
        ...booleanScalarTypes,
        ...DateScalarTypes,
        ...numberScalarTypes,
      ]),
    );
  }

  @Memoize()
  public get selection(): ILeafSelection {
    return Object.freeze({
      kind: 'Leaf',
      name: this.name,
    });
  }
}
