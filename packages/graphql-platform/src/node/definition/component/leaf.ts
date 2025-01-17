import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
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
  mutationType?: utils.MutationType.CREATION | utils.MutationType.UPDATE,
  path?: utils.Path,
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
     * Optional, add some custom validation or normalization on top of the "type"'s parser, given the value and the context among "query" (= !mutationType) / "creation" / "update"
     */
    parser?: LeafCustomParser;

    /**
     * Optional, is this leaf's value comparable?
     *
     * Default: true for all but JSON and DraftJS types
     */
    comparable?: utils.OptionalFlag;

    /**
     * Optional, is the node sortable using this leaf's value?
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
  }

  @MMethod()
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

  @MMethod()
  public isComparable(): boolean {
    const comparableConfig = this.config.comparable;
    const comparableConfigPath = utils.addPath(this.configPath, 'comparable');

    const comparable = utils.getOptionalFlag(
      comparableConfig,
      ![scalars.typesByName.DraftJS, ...scalars.jsonTypes].includes(
        this.type as any,
      ),
      comparableConfigPath,
    );

    return comparable;
  }

  @MMethod()
  public isSortable(): boolean {
    const sortableConfig = this.config.sortable;
    const sortableConfigPath = utils.addPath(this.configPath, 'sortable');

    const sortable = utils.getOptionalFlag(
      sortableConfig,
      this.isComparable() &&
        [
          ...scalars.bigintTypes,
          ...scalars.numberTypes,
          ...scalars.dateTypes,
        ].includes(this.type as any),
      sortableConfigPath,
    );

    if (sortable && !this.isComparable()) {
      throw new utils.UnexpectedValueError(
        `not to be sortable as it is not comparable`,
        sortableConfig,
        { path: sortableConfigPath },
      );
    }

    return sortable;
  }

  @MMethod()
  public override validateDefinition(): void {
    super.validateDefinition();

    this.isComparable();
    this.isSortable();
  }

  @MMethod((direction) => direction)
  public getOrderingInput(direction: OrderingDirection): LeafOrderingInput {
    assert(this.isSortable(), `The "${this}" leaf is not sortable`);

    return new LeafOrderingInput(this, direction);
  }

  @MGetter
  public override get creationInput(): LeafCreationInput {
    return new LeafCreationInput(this);
  }

  @MGetter
  public override get updateInput(): LeafUpdateInput | undefined {
    return this.isMutable() ? new LeafUpdateInput(this) : undefined;
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
    withCustomParser: boolean = true,
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

    if (this.customParser && withCustomParser) {
      let customParsedValue: LeafValue;

      try {
        customParsedValue = this.customParser(value, undefined, path);
      } catch (error) {
        throw utils.isGraphErrorWithPathEqualOrDescendantOf(error, path)
          ? error
          : new utils.GraphError(utils.castToError(error).message, {
              cause: error,
              path,
            });
      }

      return this.parseValue(customParsedValue, path, false);
    }

    return value;
  }

  public areValuesEqual(a: LeafValue, b: LeafValue): boolean {
    return utils.areGraphQLLeafValuesEqual(this.type, a, b);
  }

  public uniqValues<T extends LeafValue>(values: ReadonlyArray<T>): Array<T> {
    return R.uniqueWith(values, (a, b) => this.areValuesEqual(a, b));
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
