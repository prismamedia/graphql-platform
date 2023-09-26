import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { JsonValue, SetReturnType } from 'type-fest';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import type { OrderingDirection } from '../../statement/ordering/direction.js';
import { LeafSelection } from '../../statement/selection/expression/component/leaf.js';
import {
  LeafCreationInput,
  type LeafCreationInputConfig,
} from '../../type/input/creation/field/component/leaf.js';
import { LeafOrderingInput } from '../../type/input/ordering/expression/leaf.js';
import {
  LeafUpdateInput,
  type LeafUpdateInputConfig,
} from '../../type/input/update/field/component/leaf.js';
import {
  AbstractComponent,
  type AbstractComponentConfig,
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

export type LeafConfig<TConnector extends ConnectorInterface = any> =
  AbstractComponentConfig & {
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
  } & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.LEAF>;

export class Leaf<
  TConnector extends ConnectorInterface = any,
> extends AbstractComponent<TConnector> {
  public readonly type: LeafType;
  public readonly customParser?: LeafCustomParser;
  public override readonly selection: LeafSelection;
  readonly #comparator: (a: any, b: any) => boolean;

  public constructor(
    node: Node<any, TConnector>,
    name: utils.Name,
    public override readonly config: LeafConfig<TConnector>,
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
          throw new utils.UnexpectedValueError(
            `a non-empty Enum type`,
            typeConfig,
            { path: typeConfigPath },
          );
        }

        utils.aggregateGraphError<graphql.GraphQLEnumValue, void>(
          typeConfig.getValues(),
          (_, { name, value }) => {
            if (typeof value !== 'string' || !value) {
              throw new utils.UnexpectedValueError(
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
        throw new utils.UnexpectedValueError(
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

      if (parserConfig) {
        utils.assertFunction(parserConfig, parserConfigPath);

        this.customParser = parserConfig;
      }
    }

    // selection
    {
      this.selection = new LeafSelection(this, undefined);
    }

    // comparator
    {
      this.#comparator =
        this.type instanceof graphql.GraphQLEnumType
          ? (a: string, b: string) => a === b
          : scalars.getComparatorByType(this.type);
    }
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
      throw new utils.UnexpectedValueError(
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
  public override get updateInput(): LeafUpdateInput | undefined {
    return this.isMutable() ? new LeafUpdateInput(this) : undefined;
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): LeafValue {
    const value = utils.parseGraphQLLeafValue(this.type, maybeValue, path);

    if (value === undefined) {
      throw new utils.UnexpectedUndefinedError(this.type, { path });
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new utils.UnexpectedNullError(this.type, { path });
      }

      return null;
    }

    if (this.customParser) {
      try {
        return this.customParser(value, path);
      } catch (error) {
        throw utils.isGraphErrorWithPathEqualOrDescendantOf(error, path)
          ? error
          : new utils.GraphError(utils.castToError(error).message, {
              cause: error,
              path,
            });
      }
    }

    return value;
  }

  public areValuesEqual(a: LeafValue, b: LeafValue): boolean {
    return a === null || b === null ? a === b : this.#comparator(a, b);
  }

  public uniqValues(values: ReadonlyArray<LeafValue>): LeafValue[] {
    return R.uniqWith(values, (a, b) => this.areValuesEqual(a, b));
  }

  public serialize(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): JsonValue {
    const value = this.parseValue(maybeValue, path);

    return value === null ? null : (this.type.serialize(value) as any);
  }

  public stringify(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): string {
    return JSON.stringify(this.serialize(maybeValue, path));
  }
}
