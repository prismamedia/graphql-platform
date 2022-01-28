import {
  bigintScalarTypesByName,
  dateScalarTypesByName,
  ensureScalarType,
  getScalarComparator,
  getScalarTypeByName,
  numberScalarTypesByName,
  ScalarType,
  ScalarTypeName,
  scalarTypeNames,
} from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  aggregateConfigError,
  getOptionalFlag,
  MutationType,
  Name,
  OptionalFlag,
  parseGraphQLLeafValue,
  Path,
  UnexpectedConfigError,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { SetReturnType } from 'type-fest';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { LeafSelection } from '../../statement/selection/expression/component/leaf.js';
import {
  LeafCreationInput,
  LeafCreationInputConfig,
} from '../../type/input/creation/field/component/leaf.js';
import {
  LeafUpdateInput,
  LeafUpdateInputConfig,
} from '../../type/input/update/field/component/leaf.js';
import {
  AbstractComponent,
  AbstractComponentConfig,
} from '../abstract-component.js';

export type EnumType = graphql.GraphQLEnumType & {
  parseValue: SetReturnType<graphql.GraphQLEnumType['parseValue'], string>;
};

export type LeafType = ScalarType | EnumType;

export type LeafValue = null | ReturnType<LeafType['parseValue']>;

export type LeafUpdate = LeafValue;

export type LeafConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = AbstractComponentConfig & {
  kind: 'Leaf';

  /**
   * Required, a native "Enum" type (with "string" values only), a "Scalar" type or its name
   *
   * ex: { kind: "Leaf", type: "UUID" }
   */
  type: ScalarTypeName | LeafType;

  /**
   * Optional, is the node sortable using this component's value ?
   *
   * Default: guessed from its type
   */
  sortable?: OptionalFlag;

  /**
   * Optional, fine-tune the "creation"'s input
   */
  [MutationType.CREATION]?: LeafCreationInputConfig;

  /**
   * Optional, fine-tune the "update"'s input
   */
  [MutationType.UPDATE]?: LeafUpdateInputConfig;
} & GetConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.LEAF>;

export class Leaf<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TRequestContext, TConnector> {
  public override readonly kind: LeafConfig['kind'] = 'Leaf';
  public readonly type: LeafType;
  public override readonly selection: LeafSelection;
  public readonly sortable: boolean;
  readonly #comparator: (a: any, b: any) => boolean;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    name: Name,
    public override readonly config: LeafConfig<TRequestContext, TConnector>,
    public override readonly configPath: Path,
  ) {
    super(node, name, config, configPath);

    // type
    {
      const typeConfig = config.type;
      const typeConfigPath = addPath(configPath, 'type');

      if (typeof typeConfig === 'string') {
        this.type = getScalarTypeByName(typeConfig, typeConfigPath);
      } else if (graphql.isScalarType(typeConfig)) {
        this.type = ensureScalarType(typeConfig, typeConfigPath);
      } else if (graphql.isEnumType(typeConfig)) {
        if (!typeConfig.getValues().length) {
          throw new UnexpectedConfigError(`a non-empty Enum type`, typeConfig, {
            path: typeConfigPath,
          });
        }

        aggregateConfigError<graphql.GraphQLEnumValue, void>(
          typeConfig.getValues(),
          (_, { name, value }) => {
            if (typeof value !== 'string' || !value) {
              throw new UnexpectedConfigError(`a non-empty string`, value, {
                path: addPath(typeConfigPath, name),
              });
            }
          },
          undefined,
          { path: typeConfigPath },
        );

        this.type = typeConfig;
      } else {
        throw new UnexpectedConfigError(
          `an Enum or a Scalar among "${scalarTypeNames.join(', ')}"`,
          typeConfig,
          { path: typeConfigPath },
        );
      }
    }

    // selection
    {
      this.selection = new LeafSelection(this);
    }

    // sortable
    {
      const sortableConfig = config.sortable;
      const sortableConfigPath = addPath(configPath, 'sortable');

      this.sortable = getOptionalFlag(
        sortableConfig,
        Object.values({
          ...bigintScalarTypesByName,
          ...dateScalarTypesByName,
          ...numberScalarTypesByName,
        }).includes(this.type as any),
        sortableConfigPath,
      );
    }

    // comparator
    {
      this.#comparator =
        this.type instanceof graphql.GraphQLEnumType
          ? (a: string, b: string) => a === b
          : getScalarComparator(this.type);
    }
  }

  public parseValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): LeafValue {
    const value = parseGraphQLLeafValue(this.type, maybeValue, path);

    if (value === undefined) {
      throw new UnexpectedValueError(
        `a non-undefined "${this.type}"`,
        maybeValue,
        { path },
      );
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new UnexpectedValueError(
          `a non-null "${this.type}"`,
          maybeValue,
          { path },
        );
      }

      return null;
    }

    return value;
  }

  public parseUpdate(
    maybeUpdate: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): LeafUpdate {
    return this.parseValue(maybeUpdate, path) as any;
  }

  public areValuesEqual(a: LeafValue, b: LeafValue): boolean {
    return a === null || b === null ? a === b : this.#comparator(a, b);
  }

  @Memoize()
  public override isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = addPath(this.configPath, 'public');

    const isPublic = getOptionalFlag(
      publicConfig,
      this.node.isPublic(),
      publicConfigPath,
    );

    if (isPublic && !this.node.isPublic()) {
      throw new UnexpectedConfigError(
        `not to be "true" as the "${this.node}" node is private`,
        publicConfig,
        { path: publicConfigPath },
      );
    }

    return isPublic;
  }

  @Memoize()
  public override get creationInput(): LeafCreationInput | undefined {
    return new LeafCreationInput(this);
  }

  @Memoize()
  public override get updateInput(): LeafUpdateInput | undefined {
    return this.isMutable() ? new LeafUpdateInput(this) : undefined;
  }
}
