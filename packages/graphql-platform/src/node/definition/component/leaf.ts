import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { JsonValue, SetReturnType } from 'type-fest';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import type { OrderingDirection } from '../../statement/ordering/direction.js';
import { LeafSelection } from '../../statement/selection/expression/component/leaf.js';
import {
  LeafCreationInput,
  LeafCreationInputConfig,
} from '../../type/input/creation/field/component/leaf.js';
import { LeafOrderingInput } from '../../type/input/ordering/expression/leaf.js';
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

export type LeafType = scalars.Type | EnumType;

export type LeafValue = ReturnType<LeafType['parseValue']> | null;

export type LeafCustomParser<TValue extends LeafValue = any> = (
  value: NonNullable<TValue>,
  path: utils.Path,
) => TValue;

export type LeafConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = AbstractComponentConfig & {
  kind?: 'Leaf';

  /**
   * Required, a native "Enum" type (with "string" values only), a "Scalar" type or its name
   *
   * ex: { kind: "Leaf", type: "UUID" }
   */
  type: scalars.TypeName | LeafType;

  /**
   * Optional, add some custom validation or normalization on top of the "type"'s parser
   */
  parser?: LeafCustomParser;

  /**
   * Optional, is the node sortable using this component's value ?
   *
   * Default: guessed from its type
   */
  sortable?: utils.OptionalFlag;

  /**
   * Optional, fine-tune the "creation"'s input
   */
  [utils.MutationType.CREATION]?: LeafCreationInputConfig;

  /**
   * Optional, fine-tune the "update"'s input
   */
  [utils.MutationType.UPDATE]?: LeafUpdateInputConfig;
} & GetConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.LEAF>;

export class Leaf<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TRequestContext, TConnector> {
  public readonly type: LeafType;
  public readonly customParser?: LeafCustomParser;
  public override readonly selection: LeafSelection;
  readonly #comparator: (a: any, b: any) => boolean;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    name: utils.Name,
    public override readonly config: LeafConfig<TRequestContext, TConnector>,
    public override readonly configPath: utils.Path,
  ) {
    super(node, name, config, configPath);

    // type
    {
      const typeConfig = config.type;
      const typeConfigPath = utils.addPath(configPath, 'type');

      if (typeof typeConfig === 'string') {
        this.type = scalars.getTypeByName(typeConfig, typeConfigPath);
      } else if (graphql.isScalarType(typeConfig)) {
        this.type = scalars.ensureType(typeConfig, typeConfigPath);
      } else if (graphql.isEnumType(typeConfig)) {
        if (!typeConfig.getValues().length) {
          throw new utils.UnexpectedConfigError(
            `a non-empty Enum type`,
            typeConfig,
            { path: typeConfigPath },
          );
        }

        utils.aggregateConfigError<graphql.GraphQLEnumValue, void>(
          typeConfig.getValues(),
          (_, { name, value }) => {
            if (typeof value !== 'string' || !value) {
              throw new utils.UnexpectedConfigError(
                `a non-empty string`,
                value,
                {
                  path: utils.addPath(typeConfigPath, name),
                },
              );
            }
          },
          undefined,
          { path: typeConfigPath },
        );

        this.type = typeConfig;
      } else {
        throw new utils.UnexpectedConfigError(
          `an Enum or a Scalar among "${scalars.typeNames.join(', ')}"`,
          typeConfig,
          { path: typeConfigPath },
        );
      }
    }

    // parser
    {
      const parserConfig = config.parser;
      const parserConfigPath = utils.addPath(configPath, 'parser');

      if (parserConfig != null) {
        if (typeof parserConfig !== 'function') {
          throw new utils.UnexpectedConfigError(`a function`, parserConfig, {
            path: parserConfigPath,
          });
        }

        this.customParser = parserConfig;
      }
    }

    // selection
    {
      this.selection = new LeafSelection(this);
    }

    // comparator
    {
      this.#comparator =
        this.type instanceof graphql.GraphQLEnumType
          ? (a: string, b: string) => a === b
          : scalars.getComparatorByType(this.type);
    }
  }

  public override parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): LeafValue {
    const value = utils.parseGraphQLLeafValue(this.type, maybeValue, path);

    if (value === undefined) {
      throw new utils.UnexpectedUndefinedError(`"${this.type}"`, { path });
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new utils.UnexpectedNullError(`"${this.type}"`, { path });
      }

      return null;
    }

    if (this.customParser) {
      try {
        return this.customParser(value, path);
      } catch (error) {
        throw utils.isNestableError(error)
          ? error
          : new utils.NestableError(utils.castToError(error).message, {
              path,
              cause: error,
            });
      }
    }

    return value;
  }

  public areValuesEqual(a: LeafValue, b: LeafValue): boolean {
    return a === null || b === null ? a === b : this.#comparator(a, b);
  }

  public serialize(value: LeafValue): JsonValue {
    return value !== null ? (this.type.serialize(value) as any) : null;
  }

  @Memoize()
  public override isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = utils.addPath(this.configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      publicConfig,
      this.node.isPublic(),
      publicConfigPath,
    );

    if (isPublic && !this.node.isPublic()) {
      throw new utils.UnexpectedConfigError(
        `not to be "true" as the "${this.node}" node is private`,
        publicConfig,
        { path: publicConfigPath },
      );
    }

    return isPublic;
  }

  @Memoize()
  public isSortable(): boolean {
    const sortableConfig = this.config.sortable;
    const sortableConfigPath = utils.addPath(this.configPath, 'sortable');

    return utils.getOptionalFlag(
      sortableConfig,
      [
        scalars.typesByName.BigInt,
        scalars.typesByName.Date,
        scalars.typesByName.DateTime,
        scalars.typesByName.Float,
        scalars.typesByName.Int,
        scalars.typesByName.UnsignedBigInt,
        scalars.typesByName.UnsignedFloat,
        scalars.typesByName.UnsignedInt,
      ].includes(this.type as any),
      sortableConfigPath,
    );
  }

  @Memoize()
  public override validateDefinition(): void {
    super.validateDefinition();

    this.isSortable();
  }

  @Memoize((direction: OrderingDirection) => direction)
  public getOrderingInput(direction: OrderingDirection): LeafOrderingInput {
    assert(this.isSortable(), `The "${this}" leaf is not sortable`);

    return new LeafOrderingInput(this, direction);
  }

  @Memoize()
  public override get creationInput(): LeafCreationInput {
    return new LeafCreationInput(this);
  }

  @Memoize()
  public override get updateInput(): LeafUpdateInput {
    assert(this.isMutable(), `The "${this}" leaf is immutable`);

    return new LeafUpdateInput(this);
  }
}
