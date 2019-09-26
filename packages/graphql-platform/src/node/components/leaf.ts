import {
  bigintScalarTypes,
  booleanScalarTypes,
  DateScalarTypes,
  isScalarTypeAmong,
  isScalarTypeName,
  numberScalarTypes,
  scalarTypeByName as Scalars,
  scalarTypeNames,
  TScalarType,
} from '@prismamedia/graphql-platform-scalars';
import {
  assertLeafValue,
  getOptionalFlag,
  isLeafValue,
  OptionalFlag,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLEnumType, isEnumType } from 'graphql';
import {
  IConnector,
  TConnectorOverridesKind,
  TGetConnectorOverrides,
} from '../../connector';
import { Node } from '../../node';
import { ILeafSelection } from '../output/fields';
import { AbstractComponent, IComponentConfig } from './abstract-component';

export { scalarTypeByName as Scalars } from '@prismamedia/graphql-platform-scalars';

export type TLeafType = GraphQLEnumType | TScalarType;

export type TLeafValue = null | ReturnType<TLeafType['parseValue']>;

export type TLeafConfig<
  TContext,
  TConnector extends IConnector
> = IComponentConfig<'Leaf'> & {
  /**
   * Optional, either this leaf is exposed publicly (in the GraphQL API) or not (only available internally)
   *
   * Default: the node's visibility
   */
  public?: OptionalFlag;

  /**
   * Required, the output type is an "Enum" or a supported "Scalar"
   */
  type: GraphQLEnumType | TScalarType['name'];

  /**
   * Optional, fine-tune the inputs related to this leaf
   */
  inputs?: {
    /**
     * Optional, either the node can be sorted using this leaf's value or not
     *
     * Default: guessed from its type
     */
    sortable?: OptionalFlag;

    // /**
    //  * Optional, fine-tune the leaf's input field for creating a node record
    //  */
    // create?: ICreateLeafInputFieldConfig;
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
        `The "${this}" leaf expects an Enum or a Scalar among: ${scalarTypeNames.join(
          ', ',
        )}`,
      );
    }
  }

  @Memoize()
  public get public(): boolean {
    const isPublic = getOptionalFlag(this.config.public, this.node.public);

    assert(
      !isPublic || this.node.public,
      `The "${this}" leaf cannot be public as the "${this.node}" node is not`,
    );

    return isPublic;
  }

  @Memoize()
  public get sortable(): boolean {
    return getOptionalFlag(
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

  public isValue(
    maybeValue: unknown,
    nullable: boolean = this.nullable,
  ): maybeValue is TLeafValue {
    return maybeValue === undefined
      ? false
      : maybeValue === null
      ? nullable
      : isLeafValue(this.type, maybeValue);
  }

  public assertValue(
    maybeValue: unknown,
    nullable: boolean = this.nullable,
    path?: Path,
  ): TLeafValue {
    if (maybeValue === undefined) {
      throw new UnexpectedValueError(maybeValue, `a "${this.type}"`, path);
    } else if (maybeValue === null) {
      if (!nullable) {
        throw new UnexpectedValueError(
          maybeValue,
          `a non-null "${this.type}"`,
          path,
        );
      }

      return null;
    }

    return assertLeafValue(this.type, maybeValue, path);
  }
}
