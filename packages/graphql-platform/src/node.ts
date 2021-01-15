import {
  addPath,
  didYouMean,
  getNormalizedObject,
  getOptionalFlagValue,
  isPlainObject,
  isPublic,
  isPublicEntry,
  mapObject,
  MaybePathAwareError,
  OptionalFlagValue,
  Path,
  Public,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  TTypedEventEmitterOptions,
  TypedEventEmitter,
} from '@prismamedia/ts-typed-event-emitter';
import assert from 'assert';
import {
  assertValidName,
  GraphQLInterfaceType,
  GraphQLObjectType,
} from 'graphql';
import { camelize, pluralize } from 'inflection';
import { Promisable } from 'type-fest';
import { GraphQLPlatform } from '.';
import {
  IConnector,
  TConnectorOverridesKind,
  TGetConnectorOverrides,
} from './connector';
import {
  Edge,
  isEdgeEntry,
  isLeafComponentConfig,
  isLeafEntry,
  Leaf,
  TComponent,
  TComponentConfig,
} from './node/component';
import {
  EdgeExistenceField,
  EdgeField,
  IEdgeSelection,
  ILeafSelection,
  LeafField,
  TCustomFieldConfigMap,
  TField,
  TFieldSelection,
  TFieldValue,
} from './node/fields';
import { OrderByInput } from './node/order-by-input';
import { IReverseEdgeConfig, ReverseEdge } from './node/reverse-edge';
import {
  getNormalizedSelectionArgs,
  getSelectedNode,
  getSelectionKey,
} from './node/selection';
import {
  TUniqueConstraintConfig,
  UniqueConstraint,
} from './node/unique-constraint';
import { TFilterValue, TWhereInputValue, WhereInput } from './node/where-input';
import { WhereUniqueInput } from './node/where-unique-input';
import {
  operationConstructorMap,
  TOperation,
  TOperationConfigMap,
  TOperationKey,
  TOperationMap,
} from './operations';

export * from './node/component';
export * from './node/fields';
export * from './node/order-by-input';
export * from './node/reverse-edge';
export * from './node/selection';
export * from './node/unique-constraint';
export * from './node/where-input';
export * from './node/where-unique-input';

export interface INodeValue {
  [fieldName: string]: TFieldValue;
}

export type TNodeEventMap<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> = Record<
  'created' | 'updated' | 'deleted',
  [
    args: {
      node: Node<TContext, TConnector>;
      value: INodeValue;
      context: TContext;
    },
  ]
>;

export type TNodeConfig<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> = {
  /**
   * Optional, either the node is exposed publicly (in the GraphQL API) or not (only available internally)
   *
   * Default: true
   */
  public?: OptionalFlagValue;

  /**
   * Optional, you can provide this node's "plural" form if the one guessed is not what you expect
   *
   * Default: guessed from the name
   */
  plural?: string;

  /**
   * Optional, provide a description for this node
   */
  description?: string;

  /**
   * Optional, either the node's value can be changed or not
   *
   * Default: false
   */
  immutable?: OptionalFlagValue;

  /**
   * A component is either a "leaf" (= an Enum or a Scalar) or an "edge" (= a "link" to another node)
   *
   * At least one must be defined
   */
  components: {
    [componentName: string]: TComponentConfig<TContext, TConnector>;
  };

  /**
   * Define the "unique constraints" for this node
   *
   * At least one must be defined
   */
  uniques: TUniqueConstraintConfig<TConnector>[];

  /**
   * Optional, fine-tune the reverse edges
   */
  reverseEdges?: {
    [edgeId: string]: IReverseEdgeConfig;
  };

  /**
   * Optional, add some "custom" fields whose value is computed from the components' value
   */
  customFields?: TCustomFieldConfigMap<TContext, TConnector>;

  /**
   * Optional, implement some GraphQL interfaces
   */
  interfaces?: GraphQLInterfaceType[];

  /**
   * Optional, fine-tune the access to this node by providing a "filter" (= the "where" argument) that will always be appended to the client request, unlike the "defautArgs.where" that is replaced by the client request:
   * - "undefined" or "true" means no filter is appended
   * - "false" means no node is returned
   * - "a filter" means it will applied in a logical "AND" like: { AND: ["THE NODE FILTER", "THE CLIENT FILTER"] }
   */
  filter?: (
    context: TContext,
  ) => Promisable<TWhereInputValue | boolean | undefined>;

  /**
   * Optional, fine-tune the operations
   */
  operations?: TOperationConfigMap;

  /**
   * Optional, configure listeners on this very node
   */
  on?: TTypedEventEmitterOptions<TNodeEventMap<TContext, TConnector>>;
} & TGetConnectorOverrides<TConnector, TConnectorOverridesKind.Node>;

export class Node<
  TContext = any,
  TConnector extends IConnector = any
> extends TypedEventEmitter<TNodeEventMap<TContext, TConnector>> {
  public readonly public: boolean;
  public readonly plural: string;
  public readonly description?: string;
  public readonly immutable: boolean;
  public readonly componentMap: ReadonlyMap<string, TComponent<TConnector>>;
  public readonly leafMap: ReadonlyMap<string, Leaf<TConnector>>;
  public readonly edgeMap: ReadonlyMap<string, Edge<TConnector>>;
  public readonly uniqueConstraintMap: ReadonlyMap<
    string,
    UniqueConstraint<TConnector>
  >;
  public readonly identifier: UniqueConstraint<TConnector>;
  public readonly whereInput: WhereInput;
  public readonly orderByInput: OrderByInput;
  public readonly whereUniqueInput: WhereUniqueInput;
  public readonly operationMap: TOperationMap;

  public constructor(
    public readonly gp: GraphQLPlatform<any, TConnector>,
    public readonly name: string,
    public readonly config: TNodeConfig<any, TConnector>,
  ) {
    super(config.on);

    this.immutable = getOptionalFlagValue(config.immutable, false);
    this.description = config.description || undefined;
    this.plural = config.plural ?? pluralize(name);

    // Singular and plural forms must be differents
    assert(
      name !== this.plural,
      `A node definition expects its "singular" and "plural" forms to be different, got "${name}" (you have to provide the node's "plural" parameter)`,
    );

    // Are valid against GraphQL rules
    assertValidName(name);
    assertValidName(this.plural);

    // Are valid against GraphQL Platform rules
    const pascalCasedName = camelize(name, false);
    assert(
      name === pascalCasedName,
      `A node definition expects a name in "PascalCase", got "${name}" instead of "${pascalCasedName}"`,
    );

    const pascalCasedPlural = camelize(this.plural, false);
    assert(
      this.plural === pascalCasedPlural,
      `A node definition expects a plural form in "PascalCase", got "${this.plural}" instead of "${pascalCasedPlural}"`,
    );

    this.public = getOptionalFlagValue(config.public, gp.public);
    assert(
      !this.public || gp.public,
      `The "${name}" node cannot be public as the API is not`,
    );

    this.componentMap = new Map(
      Object.entries(config.components).map(([name, config]) => [
        name,
        isLeafComponentConfig(config)
          ? new Leaf(this, name, config)
          : new Edge(this, name, config),
      ]),
    );

    assert(
      this.componentMap.size > 0,
      `The "${name}" node expects at least one component`,
    );

    this.leafMap = new Map([...this.componentMap].filter(isLeafEntry));

    this.edgeMap = new Map([...this.componentMap].filter(isEdgeEntry));

    this.uniqueConstraintMap = new Map(
      config.uniques.map((config) => {
        const unique = new UniqueConstraint(this, config);

        return [unique.name, unique];
      }),
    );

    assert(
      this.uniqueConstraintMap.size > 0,
      `The "${name}" node expects at least one unique constraint`,
    );

    // The identifier is the first node's unique constraint
    this.identifier = [...this.uniqueConstraintMap.values()][0];

    assert(
      !this.identifier.nullable,
      `The "${name}" node's identifier (= the first unique constraint) cannot be nullable (= at least one of its components has to be non-nullable)`,
    );

    assert(
      this.identifier.immutable,
      `The "${name}" node's identifier (= the first unique constraint) has to be immutable (= all its components have to be immutable)`,
    );

    this.whereInput = new WhereInput(this);

    this.orderByInput = new OrderByInput(this);

    this.whereUniqueInput = new WhereUniqueInput(this);

    this.operationMap = mapObject(
      operationConstructorMap,
      (OperationConstructor, key) =>
        new OperationConstructor(this, this.config.operations?.[key] as any),
    );
  }

  public toString(): string {
    return this.name;
  }

  public getComponent(name: string, path?: Path): TComponent<TConnector> {
    if (!this.componentMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the component "${name}", did you mean: ${didYouMean(
          name,
          this.componentMap.keys(),
        )}`,
        path,
      );
    }

    return this.componentMap.get(name)!;
  }

  public getLeaf(name: string, path?: Path): Leaf<TConnector> {
    if (!this.leafMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the leaf "${name}", did you mean: ${didYouMean(
          name,
          this.leafMap.keys(),
        )}`,
        path,
      );
    }

    return this.leafMap.get(name)!;
  }

  public getEdge(name: string, path?: Path): Edge<TConnector> {
    if (!this.edgeMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the edge "${name}", did you mean: ${didYouMean(
          name,
          this.edgeMap.keys(),
        )}`,
        path,
      );
    }

    return this.edgeMap.get(name)!;
  }

  public getUniqueConstraint(
    name: string,
    path?: Path,
  ): UniqueConstraint<TConnector> {
    if (!this.uniqueConstraintMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the unique constraint "${name}", did you mean: ${didYouMean(
          name,
          this.uniqueConstraintMap.keys(),
        )}`,
        path,
      );
    }

    return this.uniqueConstraintMap.get(name)!;
  }

  @Memoize()
  public get publicUniqueConstraintSet(): ReadonlySet<
    Public<UniqueConstraint<TConnector>>
  > {
    assert(this.public, `"${this.name}" is private`);

    const publicUniqueConstraintSet = new Set(
      [...this.uniqueConstraintMap.values()].filter(isPublic),
    );

    assert(
      publicUniqueConstraintSet.size,
      `"${this.name}" expects at least one public unique constraint (= with all its components being public)`,
    );

    return publicUniqueConstraintSet;
  }

  @Memoize()
  public get reverseEdgeMap(): ReadonlyMap<string, ReverseEdge> {
    const reverseEdgeMap = new Map<string, ReverseEdge>();

    const reverseEdgeConfigMap: NonNullable<TNodeConfig['reverseEdges']> = {
      ...this.config.reverseEdges,
    };

    for (const node of this.gp.nodeMap.values()) {
      for (const component of node.componentMap.values()) {
        if (component instanceof Edge && component.to === this) {
          const reverseEdge = new ReverseEdge(
            component,
            reverseEdgeConfigMap[component.id],
          );

          if (reverseEdgeMap.has(reverseEdge.name)) {
            throw new Error(
              `The "${this.name}" node has more than one reverse edge named "${
                reverseEdge.name
              }", you have to configure their name through the "reverseEdges" parameter: ${[
                reverseEdgeMap.get(reverseEdge.name)!.edge.id,
                component.id,
              ].join(', ')}`,
            );
          }

          if (this.componentMap.has(reverseEdge.name)) {
            throw new Error(
              `The "${this.name}" node cannot have a reverse edge named as the component "${reverseEdge.name}", you have to configure its name through the "reverseEdges" parameter`,
            );
          }

          reverseEdgeMap.set(reverseEdge.name, reverseEdge);

          // We delete the entry in order to see if some remains at the end
          delete reverseEdgeConfigMap[component.id];
        }
      }
    }

    const missingReverseEdgeIds = Object.keys(reverseEdgeConfigMap);
    if (missingReverseEdgeIds.length > 0) {
      throw new Error(
        `The "${this}" node has unknown reverse edge definition: ${missingReverseEdgeIds.join(
          ', ',
        )}`,
      );
    }

    return reverseEdgeMap;
  }

  public getReverseEdge(name: string, path?: Path): ReverseEdge {
    if (!this.reverseEdgeMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the reverse edge "${name}", did you mean: ${didYouMean(
          name,
          this.reverseEdgeMap.keys(),
        )}`,
        path,
      );
    }

    return this.reverseEdgeMap.get(name)!;
  }

  @Memoize()
  public get fieldMap(): ReadonlyMap<string, TField> {
    const fields: TField[] = [];

    for (const component of this.componentMap.values()) {
      if (component instanceof Leaf) {
        fields.push(new LeafField(this, component));
      } else {
        fields.push(new EdgeField(this, component));
        if (component.nullable) {
          fields.push(new EdgeExistenceField(this, component));
        }
      }
    }

    // for (const reverseEdge of this.reverseEdgeMap.values()) {
    //   if (reverseEdge.unique) {
    //     fields.push(
    //       new UniqueReverseEdgeField(this, reverseEdge),
    //       new UniqueReverseEdgeExistenceField(this, reverseEdge),
    //     );
    //   } else {
    //     fields.push(
    //       new ReverseEdgeField(this, reverseEdge),
    //       new ReverseEdgeCountField(this, reverseEdge),
    //     );
    //   }
    // }

    // for (const [name, config] of Object.entries(
    //   getCustomFieldConfigMap(this, this.config?.customFields),
    // )) {
    //   fields.push(new CustomField(this, name, config));
    // }

    const fieldMap = new Map<string, TField>();

    for (const field of fields) {
      if (fieldMap.has(field.name)) {
        throw new Error(
          `"${this.name}" contains at least 2 filters with the same name "${field.name}"`,
        );
      }

      fieldMap.set(field.name, field);
    }

    return fieldMap;
  }

  public getField(name: string, path?: Path): TField {
    if (!this.fieldMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the field "${name}", did you mean: ${didYouMean(
          name,
          this.fieldMap.keys(),
        )}`,
        path,
      );
    }

    return this.fieldMap.get(name)!;
  }

  @Memoize()
  public get publicFieldMap(): ReadonlyMap<string, Public<TField>> {
    return new Map([...this.fieldMap].filter(isPublicEntry));
  }

  @Memoize()
  public get type(): GraphQLObjectType {
    assert(this.public, `"${this.name}" is private`);

    assert(
      this.publicFieldMap.size,
      `"${this.name}" expects at least one public field`,
    );

    return new GraphQLObjectType({
      name: this.name,
      description: this.description,
      interfaces: this.config?.interfaces,
      fields: () =>
        Object.fromEntries(
          Array.from(this.publicFieldMap.values(), (field) => [
            field.name,
            field.graphqlFieldConfig,
          ]),
        ),
    });
  }

  @Memoize()
  public get identifierSelections(): ReadonlyArray<
    ILeafSelection | IEdgeSelection
  > {
    return Object.freeze(
      Array.from(this.identifier.componentSet, ({ selection }) => selection),
    );
  }

  @Memoize()
  public get selections(): ReadonlyArray<ILeafSelection | IEdgeSelection> {
    return Object.freeze(
      Array.from(this.componentMap.values(), ({ selection }) => selection),
    );
  }

  public assertNodeValue(
    maybeNodeValue: unknown,
    selections: ReadonlyArray<TFieldSelection>,
    path?: Path,
  ): INodeValue {
    if (!isPlainObject(maybeNodeValue)) {
      throw new UnexpectedValueError(maybeNodeValue, `an object`, path);
    }

    return Object.fromEntries(
      selections.map((selection) => {
        const key = getSelectionKey(selection);

        return [
          selection.name,
          this.getField(selection.name).assertValue(
            maybeNodeValue[key],
            selection as any,
            addPath(path, key),
          ),
        ];
      }),
    );
  }

  public getOperation<TKey extends TOperationKey>(
    key: TKey,
    path: Path = addPath(undefined, this.name),
  ): TOperation<TKey> {
    if (!this.operationMap[key]) {
      throw new MaybePathAwareError(
        `The "${
          this.name
        }" node does not contain the operation "${key}", did you mean: ${didYouMean(
          key,
          Object.keys(this.operationMap),
        )}`,
        path,
      );
    }

    return this.operationMap[key];
  }

  /**
   * Given a filter, appends the one configured to produce the one actually provided to the connector
   */
  public async getContextualizedFilter(
    filter: TWhereInputValue | boolean | undefined,
    context: TContext,
    path: Path,
  ): Promise<TFilterValue> {
    return this.whereInput.parseValue(
      {
        AND: [await this.config.filter?.(context), filter].filter(
          (value) => value !== undefined,
        ),
      },
      path,
    );
  }

  /**
   * Given an array of selection, returns a new one with contextualized filter where it matters
   */
  public async getContextualizedSelections(
    selections: ReadonlyArray<TFieldSelection>,
    context: TContext,
    path: Path,
  ): Promise<Array<TFieldSelection>> {
    return Promise.all(
      selections.map(async (selection) => {
        switch (selection.kind) {
          case 'Edge':
          case 'EdgeExistence':
          case 'ReverseEdge':
          case 'ReverseEdgeCount':
          case 'UniqueReverseEdge':
          case 'UniqueReverseEdgeExistence': {
            const selectedNode = getSelectedNode(this, selection);

            const contextualizedFilter = await selectedNode.getContextualizedFilter(
              selection.args?.filter,
              context,
              addPath(path, getSelectionKey(selection)),
            );

            const args = getNormalizedObject({
              ...getNormalizedSelectionArgs(selection),
              filter:
                contextualizedFilter.kind === 'Boolean' &&
                contextualizedFilter.value
                  ? undefined
                  : contextualizedFilter,
            });

            return <TFieldSelection>{
              ...selection,
              ...(args && { args }),
              ...('selections' in selection && {
                selections: await selectedNode.getContextualizedSelections(
                  selection.selections,
                  context,
                  addPath(path, getSelectionKey(selection)),
                ),
              }),
            };
          }

          default:
            return selection;
        }
      }),
    );
  }
}
