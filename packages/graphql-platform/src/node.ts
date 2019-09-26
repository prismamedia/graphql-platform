import {
  addPath,
  didYouMean,
  getOptionalFlag,
  isPlainObject,
  MaybePathAwareError,
  normalizeObject,
  OptionalFlag,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  TTypedEventEmitterOptions,
  TypedEventEmitter,
} from '@prismamedia/ts-typed-event-emitter';
import assert from 'assert';
import { assertValidName, GraphQLInterfaceType } from 'graphql';
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
} from './node/components';
import {
  operationConstructorMap,
  TOperation,
  TOperationConfigMap,
  TOperationKey,
  TOperationMap,
} from './node/operations';
import { IReverseEdgeConfig, ReverseEdge } from './node/reverse-edge';
import {
  getNormalizedSelectionArgs,
  getSelectedNode,
  getSelectionKey,
  IEdgeSelection,
  ILeafSelection,
  NodeOutput,
  OrderByNodeInput,
  TCustomFieldConfigMap,
  TFilterValue,
  TNodeOutputFieldValue,
  TNodeOutputSelection,
  TWhereNodeValue,
  WhereNodeInput,
  WhereUniqueNodeInput,
} from './node/types';
import {
  TUniqueConstraintConfig,
  UniqueConstraint,
} from './node/unique-constraint';

export * from './node/components';
export * from './node/operations';
export * from './node/reverse-edge';
export * from './node/types';
export * from './node/unique-constraint';

export interface INodeValue {
  [fieldName: string]: TNodeOutputFieldValue;
}

export type TNodeEventMap<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> = Record<
  'created' | 'updated' | 'deleted',
  [
    args: {
      node: Node<TConnector>;
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
  public?: OptionalFlag;

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
   * A component is either a "leaf" (= an Enum or a Scalar) or an "edge" (= a "link" to another node)
   *
   * At least one must be defined
   */
  components: {
    /**
     * The components' name are expected to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [componentName: string]: TComponentConfig<TContext, TConnector>;
  };

  /**
   * Define the "unique constraints" for this node
   *
   * At least one must be defined
   */
  uniques: TUniqueConstraintConfig<TConnector>[];

  /**
   * Optional, define some reverse edges
   */
  reverseEdges?: {
    [reverseEdgeName: string]: IReverseEdgeConfig;
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
   * - "null" or "false" means no node is returned
   * - "a filter" means it will applied in a logical "AND" like: { AND: ["THE NODE FILTER", "THE CLIENT FILTER"] }
   */
  filter?: (
    context: TContext,
  ) => Promisable<TWhereNodeValue | boolean | null | undefined>;

  /**
   * Optional, fine-tune the operations for this node
   */
  operations?: TOperationConfigMap;

  /**
   * Optional, configure listeners on this very node
   */
  on?: TTypedEventEmitterOptions<TNodeEventMap<TContext, TConnector>>;
} & TGetConnectorOverrides<TConnector, TConnectorOverridesKind.Node>;

export class Node<
  TConnector extends IConnector = any
> extends TypedEventEmitter<TNodeEventMap<any, TConnector>> {
  public readonly public: boolean;
  public readonly plural: string;
  public readonly description?: string;
  public readonly componentMap: ReadonlyMap<string, TComponent>;
  public readonly leafMap: ReadonlyMap<string, Leaf>;
  public readonly edgeMap: ReadonlyMap<string, Edge>;
  public readonly uniqueConstraintMap: ReadonlyMap<string, UniqueConstraint>;
  public readonly identifier: UniqueConstraint;

  public constructor(
    public readonly gp: GraphQLPlatform<any, TConnector>,
    public readonly name: string,
    public readonly config: TNodeConfig<any, TConnector>,
  ) {
    super(config.on);

    this.description = config.description || undefined;
    this.plural = config.plural ?? pluralize(name);

    // Singular and plural forms must be differents
    assert(
      name !== this.plural,
      `A node definition expects its "singular" and "plural" forms to be different, got "${name}" (you have to provide the node's "plural" parameter)`,
    );

    // Are valid against the GraphQL rules
    assertValidName(name);
    assertValidName(this.plural);

    // Are valid against the GraphQL Platform rules
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

    this.public = getOptionalFlag(config.public, gp.public);
    assert(
      !this.public || gp.public,
      `The "${name}" node cannot be public as the GraphQL Platform is not`,
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
  }

  public toString(): string {
    return this.name;
  }

  public getComponent(name: string, path?: Path): TComponent {
    const component = this.componentMap.get(name);
    if (!component) {
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

    return component;
  }

  public getLeaf(name: string, path?: Path): Leaf {
    const leaf = this.leafMap.get(name);
    if (!leaf) {
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

    return leaf;
  }

  public getEdge(name: string, path?: Path): Edge {
    const edge = this.edgeMap.get(name);
    if (!edge) {
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

    return edge;
  }

  public getUniqueConstraint(name: string, path?: Path): UniqueConstraint {
    const uniqueConstraint = this.uniqueConstraintMap.get(name);
    if (!uniqueConstraint) {
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

    return uniqueConstraint;
  }

  @Memoize()
  public get reverseEdgeMap(): ReadonlyMap<string, ReverseEdge> {
    const reverseEdgeMap = new Map<string, ReverseEdge>();

    if (this.config.reverseEdges) {
      for (const [name, config] of Object.entries(this.config.reverseEdges)) {
        const reverseEdge = new ReverseEdge(this, name, config);
        assert(
          !this.componentMap.has(reverseEdge.name),
          `A component and a reverse edge have the same name "${name}"`,
        );

        reverseEdgeMap.set(reverseEdge.name, reverseEdge);
      }
    }

    return reverseEdgeMap;
  }

  public getReverseEdge(name: string, path?: Path): ReverseEdge {
    const reverseEdge = this.reverseEdgeMap.get(name);
    if (!reverseEdge) {
      throw new MaybePathAwareError(
        `The "${this}" node does not contain the reverse edge "${name}", did you mean: ${didYouMean(
          name,
          this.reverseEdgeMap.keys(),
        )}`,
        path,
      );
    }

    return reverseEdge;
  }

  @Memoize()
  public get whereUniqueInput(): WhereUniqueNodeInput {
    return new WhereUniqueNodeInput(this);
  }

  @Memoize()
  public get whereInput(): WhereNodeInput {
    return new WhereNodeInput(this);
  }

  @Memoize()
  public get orderByInput(): OrderByNodeInput {
    return new OrderByNodeInput(this);
  }

  @Memoize()
  public get output(): NodeOutput {
    return new NodeOutput(this);
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
    selections: ReadonlyArray<TNodeOutputSelection>,
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

  @Memoize()
  public get operationMap(): TOperationMap {
    return Object.fromEntries(
      Object.entries(
        operationConstructorMap,
      ).map(([key, OperationConstructor]) => [
        key,
        new (OperationConstructor as any)(
          this,
          (this.config.operations as any)?.[key],
        ),
      ]),
    ) as TOperationMap;
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
    filter: TWhereNodeValue | boolean | null | undefined,
    context: any,
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
    selections: ReadonlyArray<TNodeOutputSelection>,
    context: any,
    path: Path,
  ): Promise<Array<TNodeOutputSelection>> {
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

            const args = normalizeObject({
              ...getNormalizedSelectionArgs(selection),
              filter:
                contextualizedFilter.kind === 'Boolean' &&
                contextualizedFilter.value
                  ? undefined
                  : contextualizedFilter,
            });

            return <TNodeOutputSelection>{
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
