import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import { OperationTypeNode } from 'graphql';
import inflection from 'inflection';
import type { JsonObject, Promisable } from 'type-fest';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';
import type { NodeChange } from './node/change.js';
import { NodeCursor, type NodeCursorOptions } from './node/cursor.js';
import {
  Edge,
  Leaf,
  MultipleReverseEdge,
  UniqueConstraint,
  UniqueReverseEdge,
  isComponent,
  type Component,
  type ComponentConfig,
  type ComponentValue,
  type OnEdgeHeadDeletion,
  type ReverseEdge,
  type ReverseEdgeConfig,
  type UniqueConstraintConfig,
  type UniqueConstraintValue,
} from './node/definition.js';
import { assertNodeName, type NodeName } from './node/name.js';
import {
  createContextBoundNodeAPI,
  createNodeAPI,
  operationConstructorsByType,
  type ContextBoundNodeAPI,
  type MutationConfig,
  type NodeAPI,
  type Operation,
  type OperationByType,
  type OperationContext,
  type OperationType,
  type OperationsByType,
} from './node/operation.js';
import {
  NodeSelection,
  mergeSelectionExpressions,
  type NodeFilter,
  type NodeSelectedValue,
} from './node/statement.js';
import {
  NodeSubscription,
  type NodeSubscriptionOptions,
} from './node/subscription.js';
import {
  NodeCreationInputType,
  NodeFilterInputType,
  NodeFilterInputValue,
  NodeOrderingInputType,
  NodeOutputType,
  NodeUniqueFilterInputType,
  NodeUpdateInputType,
  type NodeOutputTypeConfig,
} from './node/type.js';

export * from './node/change.js';
export * from './node/cursor.js';
export * from './node/definition.js';
export * from './node/fixture.js';
export * from './node/loader.js';
export * from './node/name.js';
export * from './node/operation.js';
export * from './node/statement.js';
export * from './node/subscription.js';
export * from './node/type.js';

type OperationsByKeyByType<TRequestContext extends object = any> = {
  [TType in OperationType]: {
    [TOperation in OperationByType<TRequestContext>[TType] as TOperation['key']]: TOperation;
  };
};

type OperationsByMethod<TRequestContext extends object = any> = {
  [TOperation in Operation<TRequestContext> as TOperation['method']]: TOperation;
};

/**
 * Includes all the components' value
 *
 * -> think of a "row" in SQL or a "document" in NoSQL
 */
export type NodeValue = NodeSelectedValue &
  UniqueConstraintValue &
  Record<Component['name'], ComponentValue>;

export type NodeAuthorizer<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TContainer>,
  requestContext: TRequestContext,
  mutationType?: utils.MutationType,
) => NodeFilterInputValue | boolean;

export type NodeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = {
  /**
   * Optional, you can provide this node's plural form if the one guessed is not what you expect
   *
   * Default: guessed from the name
   */
  plural?: string;

  /**
   * Optional, provide a description for this node
   */
  description?: utils.OptionalDescription;

  /**
   * Optional, either this node is deprecated or not
   *
   * The information will be shown in all its operations
   */
  deprecated?: utils.OptionalDeprecation;

  /**
   * A component is either a leaf (= an enum or a scalar) or an edge (= a link to another node)
   *
   * At least one must be defined
   */
  components: {
    /**
     * The components' name are expected to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [componentName: utils.Name]: ComponentConfig<TConnector>;
  };

  /**
   * Define the unique-constraints for this node
   *
   * At least one must be defined
   *
   * The first one will become this node's identifier, a special unique-constraint with some additional restrictions, it must be:
   *  - non-nullable (= at least one of its components being non-nullable)
   *  - immutable (= all its components being immutable)
   */
  uniques: UniqueConstraintConfig<TConnector>[];

  /**
   * Optional, define some reverse edges
   *
   * @see https://en.wikipedia.org/wiki/Glossary_of_graph_theory#inverted_arrow
   */
  reverseEdges?: {
    /**
     * The reverse edges' name are expected to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [reverseEdge: utils.Name]: ReverseEdgeConfig;
  };

  /**
   * Optional, either the node is exposed publicly (in the GraphQL API) or not (only available internally)
   *
   * Default: true
   */
  public?: utils.OptionalFlag;

  /**
   * Optional, fine-tune the output type generated from this node's definition
   */
  output?: NodeOutputTypeConfig<TRequestContext, TConnector, TContainer>;

  /**
   * Optional, fine-tune the "mutation":
   *
   * - "true" means all the "mutations" are enabled
   * - "false" means all the "mutations" are disabled
   */
  mutation?:
    | boolean
    | {
        [TType in keyof MutationConfig<
          TRequestContext,
          TConnector,
          TContainer
        >]?:
          | boolean
          | MutationConfig<TRequestContext, TConnector, TContainer>[TType];
      };

  /**
   * Optional, fine-tune the access to these nodes, given the request-context and the access-type among "query" (= !mutationType) / "creation" / "update" / "deletion":
   * - deny all access by returning either "false" or "null"
   * - grant full access by returning either "true" or "undefined"
   * - grant access to a subset by returning a filter (= the "where" argument)
   */
  authorization?: NodeAuthorizer<TRequestContext, TConnector, TContainer>;

  /**
   * Optional, you may want to filter the "changes" to avoid some useless processing in the "change-aggregation" and "change" listeners
   */
  changeFilter?: (
    this: Node<TRequestContext, TConnector, TContainer>,
    change: NodeChange<TRequestContext, TConnector, TContainer>,
  ) => boolean;

  /**
   * Optional, register a change-aggregation-listener
   */
  onChangeAggregation?: (
    this: Node<TRequestContext, TConnector, TContainer>,
    changes: ReadonlyArray<NodeChange<TRequestContext, TConnector, TContainer>>,
  ) => Promisable<void>;

  /**
   * Optional, register a change-listener
   */
  onChange?: (
    this: Node<TRequestContext, TConnector, TContainer>,
    change: NodeChange<TRequestContext, TConnector, TContainer>,
  ) => Promisable<void>;
} & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.NODE>;

export class Node<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> {
  public readonly plural: string;
  public readonly indefinite: string;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;

  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector, TContainer>
  >;

  public readonly componentSet: ReadonlySet<
    Component<TRequestContext, TConnector, TContainer>
  >;

  public readonly leavesByName: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector, TContainer>
  >;

  public readonly leafSet: ReadonlySet<
    Leaf<TRequestContext, TConnector, TContainer>
  >;

  public readonly edgesByName: ReadonlyMap<
    Edge['name'],
    Edge<TRequestContext, TConnector, TContainer>
  >;

  public readonly edgeSet: ReadonlySet<
    Edge<TRequestContext, TConnector, TContainer>
  >;

  public readonly uniqueConstraintsByName: ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint<TRequestContext, TConnector, TContainer>
  >;

  public readonly uniqueConstraintSet: ReadonlySet<
    UniqueConstraint<TRequestContext, TConnector, TContainer>
  >;

  public readonly identifier: UniqueConstraint<
    TRequestContext,
    TConnector,
    TContainer
  >;

  readonly #changeFilter?: (
    change: NodeChange<TRequestContext, TConnector, TContainer>,
  ) => boolean;

  /**
   * Make it easy to call the operations:
   *
   * @example
   * const articles = await api.findMany(myRequestContext, { where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  public readonly api: NodeAPI<TRequestContext>;

  public constructor(
    public readonly gp: GraphQLPlatform<
      TRequestContext,
      TConnector,
      TContainer
    >,
    public readonly name: NodeName,
    public readonly config: NodeConfig<TRequestContext, TConnector, TContainer>,
    public readonly configPath: utils.Path,
  ) {
    assertNodeName(name, configPath);
    utils.assertPlainObject(config, configPath);

    // change-filter
    {
      const changeFilterConfig = config.changeFilter;
      const changeFilterConfigPath = utils.addPath(configPath, 'changeFilter');

      if (changeFilterConfig) {
        utils.assertFunction(changeFilterConfig, changeFilterConfigPath);

        this.#changeFilter = changeFilterConfig.bind(this);
      }
    }

    // on-change-aggregation
    {
      const onChangeAggregation = config.onChangeAggregation;
      const onChangeAggregationPath = utils.addPath(
        configPath,
        'onChangeAggregation',
      );

      if (onChangeAggregation) {
        utils.assertFunction(onChangeAggregation, onChangeAggregationPath);

        gp.on('node-change-aggregation', (aggregation) => {
          const changes = aggregation.changesByNode.get(this);
          if (changes?.length) {
            return onChangeAggregation.call(this, changes);
          }
        });
      }
    }

    // on-change
    {
      const onChange = config.onChange;
      const onChangePath = utils.addPath(configPath, 'onChange');

      if (onChange) {
        utils.assertFunction(onChange, onChangePath);

        gp.on('node-change', (change) => {
          if (change.node === this) {
            return onChange.call(this, change);
          }
        });
      }
    }

    // plural
    {
      const pluralConfig = config.plural;
      const pluralConfigPath = utils.addPath(configPath, 'plural');

      this.plural = utils.ensureName(
        pluralConfig ?? inflection.pluralize(name),
        pluralConfigPath,
      );

      const pascalCasedPlural = inflection.camelize(this.plural, false);
      if (this.plural !== pascalCasedPlural) {
        throw new utils.UnexpectedValueError(
          `a "plural" form in PascalCase (= "${pascalCasedPlural}")`,
          pluralConfig,
          { path: pluralConfigPath },
        );
      }

      if (name === this.plural) {
        throw new utils.UnexpectedValueError(
          `differents "singular" and "plural" forms, you have to define the "plural" parameter as we were not able to guess a valid one`,
          pluralConfig,
          { path: pluralConfigPath },
        );
      }
    }

    // indefinite
    {
      this.indefinite = utils.indefinite(name);
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = utils.addPath(configPath, 'description');

      this.description = utils.getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }

    // deprecated
    {
      const deprecatedConfig = config.deprecated;
      const deprecatedConfigPath = utils.addPath(configPath, 'deprecated');

      this.deprecationReason = utils.getOptionalDeprecation(
        deprecatedConfig,
        `The "${this.name}" node is deprecated`,
        deprecatedConfigPath,
      );
    }

    // components
    {
      const componentsConfig = config.components;
      const componentsConfigPath = utils.addPath(configPath, 'components');

      utils.assertPlainObject(componentsConfig, componentsConfigPath);

      if (!Object.entries(componentsConfig).length) {
        throw new utils.UnexpectedValueError(
          `at least one component`,
          componentsConfig,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        utils.aggregateGraphError<
          [Component['name'], ComponentConfig],
          [Component['name'], Component][]
        >(
          Object.entries(componentsConfig),
          (entries, [componentName, componentConfig]) => {
            const componentConfigPath = utils.addPath(
              componentsConfigPath,
              componentName,
            );

            utils.assertPlainObject(componentConfig, componentConfigPath);

            let component: Component;

            const kindConfig = componentConfig.kind;
            const kindConfigPath = utils.addPath(componentConfigPath, 'kind');

            if (!kindConfig || kindConfig === 'Leaf') {
              component = new Leaf(
                this,
                componentName,
                componentConfig,
                componentConfigPath,
              );
            } else if (kindConfig === 'Edge') {
              component = new Edge(
                this,
                componentName,
                componentConfig,
                componentConfigPath,
              );
            } else {
              throw new utils.UnreachableValueError(kindConfig, {
                path: kindConfigPath,
              });
            }

            return [...entries, [component.name, component]];
          },
          [],
          { path: componentsConfigPath },
        ),
      );

      this.componentSet = new Set(this.componentsByName.values());

      // leaves
      {
        this.leavesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Leaf] => entry[1] instanceof Leaf,
          ),
        );

        this.leafSet = new Set(this.leavesByName.values());
      }

      // edges
      {
        this.edgesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Edge] => entry[1] instanceof Edge,
          ),
        );

        this.edgeSet = new Set(this.edgesByName.values());
      }
    }

    // uniques
    {
      const uniquesConfig = config.uniques;
      const uniquesConfigPath = utils.addPath(configPath, 'uniques');

      if (!Array.isArray(uniquesConfig) || !uniquesConfig.length) {
        throw new utils.UnexpectedValueError(
          `at least one unique-constraint`,
          uniquesConfig,
          { path: uniquesConfigPath },
        );
      }

      this.uniqueConstraintsByName = new Map(
        utils.aggregateGraphError<
          UniqueConstraintConfig,
          [UniqueConstraint['name'], UniqueConstraint][]
        >(
          uniquesConfig,
          (entries, uniqueConstraintConfig, index) => {
            const unique = new UniqueConstraint(
              this,
              uniqueConstraintConfig,
              utils.addPath(uniquesConfigPath, index),
            );

            return [...entries, [unique.name, unique]];
          },
          [],
          { path: uniquesConfigPath },
        ),
      );

      this.uniqueConstraintSet = new Set(this.uniqueConstraintsByName.values());

      // identifier (= the first unique-constraint)
      {
        const identifierConfigPath = utils.addPath(uniquesConfigPath, 0);

        this.identifier = this.uniqueConstraintsByName.values().next().value;

        if (this.identifier.isNullable()) {
          throw new utils.GraphError(
            `Expects its identifier (= the first unique-constraint, composed of the component${
              this.identifier.isComposite() ? 's' : ''
            } "${[...this.identifier.componentsByName.keys()].join(
              ', ',
            )}") to be non-nullable (= at least one of its components being non-nullable)`,
            { path: identifierConfigPath },
          );
        }

        if (this.identifier.isMutable()) {
          throw new utils.GraphError(
            `Expects its identifier (= the first unique-constraint, composed of the component${
              this.identifier.isComposite() ? 's' : ''
            } "${[...this.identifier.componentsByName.keys()].join(
              ', ',
            )}") to be immutable (= all its components being immutable)`,
            { path: identifierConfigPath },
          );
        }
      }
    }

    // authorization
    {
      const authorizationConfig = config.authorization;
      const authorizationConfigPath = utils.addPath(
        configPath,
        'authorization',
      );

      utils.assertNillableFunction(
        authorizationConfig,
        authorizationConfigPath,
      );
    }

    // API
    {
      this.api = createNodeAPI(this);
    }
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = utils.addPath(this.configPath, 'public');

    return utils.getOptionalFlag(publicConfig, true, publicConfigPath);
  }

  @Memoize((mutationType: utils.MutationType) => mutationType)
  public getMutationConfig<TType extends utils.MutationType>(
    mutationType: TType,
  ): {
    config?: MutationConfig<TRequestContext, TConnector, TContainer>[TType];
    configPath: utils.Path;
  } {
    const mutationsConfig = this.config.mutation;
    const mutationsConfigPath = utils.addPath(this.configPath, 'mutation');

    if (typeof mutationsConfig === 'boolean') {
      return {
        config: { enabled: mutationsConfig },
        configPath: mutationsConfigPath,
      };
    } else if (utils.isPlainObject(mutationsConfig)) {
      const mutationConfig = mutationsConfig[mutationType];
      const mutationConfigPath = utils.addPath(
        mutationsConfigPath,
        mutationType,
      );

      if (typeof mutationConfig === 'boolean') {
        return {
          config: { enabled: mutationConfig },
          configPath: mutationConfigPath,
        };
      } else if (utils.isPlainObject(mutationConfig)) {
        return {
          config: mutationConfig,
          configPath: mutationConfigPath,
        };
      } else if (mutationConfig != null) {
        throw new utils.UnexpectedValueError(
          `a boolean or a plain-object`,
          mutationConfig,
          { path: mutationConfigPath },
        );
      }
    } else if (mutationsConfig != null) {
      throw new utils.UnexpectedValueError(
        `a boolean or a plain-object`,
        mutationsConfig,
        { path: mutationsConfigPath },
      );
    }

    return {
      configPath: mutationsConfigPath,
    };
  }

  @Memoize((mutationType: utils.MutationType) => mutationType)
  public isMutable(mutationType: utils.MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    return utils.getOptionalFlag(
      config?.enabled,
      true,
      utils.addPath(configPath, 'enabled'),
    );
  }

  public isCreatable(): boolean {
    return this.isMutable(utils.MutationType.CREATION);
  }

  public isUpdatable(excludedEdge?: Edge): boolean {
    excludedEdge && this.ensureEdge(excludedEdge);

    return (
      this.isMutable(utils.MutationType.UPDATE) &&
      (!excludedEdge ||
        Array.from(this.componentSet).some(
          (component) => component !== excludedEdge && component.updateInput,
        ))
    );
  }

  public isDeletable(): boolean {
    return this.isMutable(utils.MutationType.DELETION);
  }

  @Memoize((mutationType: utils.MutationType) => mutationType)
  public isPubliclyMutable(mutationType: utils.MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    const publicConfig = config?.public;
    const publicConfigPath = utils.addPath(configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      publicConfig,
      this.isPublic() && this.isMutable(mutationType),
      publicConfigPath,
    );

    if (isPublic) {
      if (!this.isPublic()) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as the "${this}" node is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }

      if (!this.isMutable(mutationType)) {
        throw new utils.UnexpectedValueError(
          `not to be "true" as the "${this}" node's ${mutationType} is disabled`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }

    return isPublic;
  }

  public isPubliclyCreatable(excludedEdge?: Edge): boolean {
    excludedEdge && this.ensureEdge(excludedEdge);

    return (
      this.isPubliclyMutable(utils.MutationType.CREATION) &&
      (!excludedEdge ||
        Array.from(this.componentSet).some(
          (component) =>
            component !== excludedEdge && component.creationInput.isPublic(),
        ))
    );
  }

  public isPubliclyUpdatable(excludedEdge?: Edge): boolean {
    excludedEdge && this.ensureEdge(excludedEdge);

    return (
      this.isPubliclyMutable(utils.MutationType.UPDATE) &&
      (!excludedEdge ||
        Array.from(this.componentSet).some(
          (component) =>
            component !== excludedEdge && component.updateInput?.isPublic(),
        ))
    );
  }

  public isPubliclyDeletable(): boolean {
    return this.isPubliclyMutable(utils.MutationType.DELETION);
  }

  public getComponentByName(
    name: Component['name'],
    path?: utils.Path,
  ): Component<TRequestContext, TConnector, TContainer> {
    const component = this.componentsByName.get(name);
    if (!component) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s component among "${[
          ...this.componentsByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return component;
  }

  public ensureComponent(
    componentOrName: Component | Component['name'],
    path?: utils.Path,
  ): Component<TRequestContext, TConnector, TContainer> {
    if (typeof componentOrName === 'string') {
      return this.getComponentByName(componentOrName, path);
    } else if (
      isComponent(componentOrName) &&
      this.componentSet.has(componentOrName)
    ) {
      return componentOrName;
    }

    throw new utils.UnexpectedValueError(
      `${this.indefinite}'s component among "${[
        ...this.componentsByName.keys(),
      ].join(', ')}"`,
      String(componentOrName),
      { path },
    );
  }

  public getLeafByName(
    name: Leaf['name'],
    path?: utils.Path,
  ): Leaf<TRequestContext, TConnector, TContainer> {
    const leaf = this.leavesByName.get(name);
    if (!leaf) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s leaf among "${[...this.leavesByName.keys()].join(
          ', ',
        )}"`,
        name,
        { path },
      );
    }

    return leaf;
  }

  public ensureLeaf(
    leafOrName: Leaf | Leaf['name'],
    path?: utils.Path,
  ): Leaf<TRequestContext, TConnector, TContainer> {
    if (typeof leafOrName === 'string') {
      return this.getLeafByName(leafOrName, path);
    } else if (leafOrName instanceof Leaf && this.leafSet.has(leafOrName)) {
      return leafOrName;
    }

    throw new utils.UnexpectedValueError(
      `${this.indefinite}'s leaf among "${[...this.leavesByName.keys()].join(
        ', ',
      )}"`,
      String(leafOrName),
      { path },
    );
  }

  public getEdgeByName(
    name: Edge['name'],
    path?: utils.Path,
  ): Edge<TRequestContext, TConnector, TContainer> {
    const edge = this.edgesByName.get(name);
    if (!edge) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s edge among "${[...this.edgesByName.keys()].join(
          ', ',
        )}"`,
        name,
        { path },
      );
    }

    return edge;
  }

  public ensureEdge(
    edgeOrName: Edge | Edge['name'],
    path?: utils.Path,
  ): Edge<TRequestContext, TConnector, TContainer> {
    if (typeof edgeOrName === 'string') {
      return this.getEdgeByName(edgeOrName, path);
    } else if (edgeOrName instanceof Edge && this.edgeSet.has(edgeOrName)) {
      return edgeOrName;
    }

    throw new utils.UnexpectedValueError(
      `${this.indefinite}'s edge among "${[...this.edgesByName.keys()].join(
        ', ',
      )}"`,
      String(edgeOrName),
      { path },
    );
  }

  public getUniqueConstraintByName(
    name: UniqueConstraint['name'],
    path?: utils.Path,
  ): UniqueConstraint<TRequestContext, TConnector, TContainer> {
    const uniqueConstraint = this.uniqueConstraintsByName.get(name);
    if (!uniqueConstraint) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s unique-constraint among "${[
          ...this.uniqueConstraintsByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return uniqueConstraint;
  }

  @Memoize((edge: Edge) => edge)
  public isPartiallyIdentifiableWithEdge(edge: Edge): boolean {
    this.ensureEdge(edge);

    return Array.from(this.uniqueConstraintSet).some(
      (uniqueConstraint) =>
        uniqueConstraint.componentSet.has(edge) &&
        uniqueConstraint.componentSet.size > 1,
    );
  }

  @Memoize((edge: Edge) => edge)
  public isPubliclyPartiallyIdentifiableWithEdge(edge: Edge): boolean {
    this.ensureEdge(edge);

    return Array.from(this.uniqueConstraintSet).some(
      (uniqueConstraint) =>
        uniqueConstraint.isPublic() &&
        uniqueConstraint.componentSet.has(edge) &&
        uniqueConstraint.componentSet.size > 1,
    );
  }

  @Memoize()
  public get selection(): NodeSelection<NodeValue> {
    return new NodeSelection(
      this,
      mergeSelectionExpressions(
        Array.from(this.componentSet, ({ selection }) => selection),
      ),
    );
  }

  @Memoize()
  public get reverseEdgesByName(): ReadonlyMap<
    ReverseEdge['name'],
    ReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    // Let's find all the edges heading to this node
    const referrersByNameByNodeName = new Map<
      Node['name'],
      Map<Edge['name'], Edge>
    >(
      Array.from(
        this.gp.nodesByName.values(),
        (node): [Node['name'], Map<Edge['name'], Edge>] => [
          node.name,
          new Map(
            Array.from(node.componentsByName).filter(
              (entry): entry is [Edge['name'], Edge] =>
                entry[1] instanceof Edge && entry[1].head === this,
            ),
          ),
        ],
      ).filter(([, referrersByName]) => referrersByName.size),
    );

    const reverseEdgesConfig = this.config.reverseEdges;
    const reverseEdgesConfigPath = utils.addPath(
      this.configPath,
      'reverseEdges',
    );

    utils.assertNillablePlainObject(reverseEdgesConfig, reverseEdgesConfigPath);

    // No reverse-edge
    if (!referrersByNameByNodeName.size) {
      if (
        utils.isPlainObject(reverseEdgesConfig) &&
        Object.entries(reverseEdgesConfig).length
      ) {
        throw new utils.UnexpectedValueError(
          `no configuration as there is no node having an edge heading to the "${this}" node`,
          reverseEdgesConfig,
          { path: reverseEdgesConfigPath },
        );
      }

      return new Map();
    }

    const reverseEdges = new Map(
      reverseEdgesConfig
        ? utils.aggregateGraphError<
            [ReverseEdge['name'], ReverseEdgeConfig],
            [ReverseEdge['name'], ReverseEdge][]
          >(
            Object.entries(reverseEdgesConfig),
            (entries, [reverseEdgeName, reverseEdgeConfig]) => {
              const reverseEdgeConfigPath = utils.addPath(
                reverseEdgesConfigPath,
                reverseEdgeName,
              );

              if (this.componentsByName.has(reverseEdgeName)) {
                throw new utils.UnexpectedValueError(
                  `a "name" not among "${[...this.componentsByName.keys()].join(
                    ', ',
                  )}"`,
                  reverseEdgeName,
                  { path: reverseEdgeConfigPath },
                );
              }

              utils.assertPlainObject(reverseEdgeConfig, reverseEdgeConfigPath);

              const originalEdgeConfig = reverseEdgeConfig.originalEdge;
              const originalEdgeConfigPath = utils.addPath(
                reverseEdgeConfigPath,
                'originalEdge',
              );

              if (
                typeof originalEdgeConfig !== 'string' ||
                !originalEdgeConfig
              ) {
                throw new utils.UnexpectedValueError(
                  `a non-empty string`,
                  originalEdgeConfig,
                  { path: originalEdgeConfigPath },
                );
              }

              const [nodeEdgeConfig, edgeEdgeConfig] =
                originalEdgeConfig.split('.');

              const referrersByName =
                referrersByNameByNodeName.get(nodeEdgeConfig);

              if (!referrersByName) {
                throw new utils.UnexpectedValueError(
                  `a node having an edge heading to the "${this}" node (= a value among "${[
                    ...referrersByNameByNodeName.keys(),
                  ].join(', ')}")`,
                  nodeEdgeConfig,
                  { path: originalEdgeConfigPath },
                );
              } else if (!referrersByName.size) {
                throw new utils.GraphError(
                  `Expects no more configuration for "${nodeEdgeConfig}"'s edge as there is no more edge heading to the "${this}" node`,
                  { path: originalEdgeConfigPath },
                );
              }

              let originalEdge: Edge;

              if (edgeEdgeConfig) {
                if (!referrersByName.has(edgeEdgeConfig)) {
                  throw new utils.UnexpectedValueError(
                    `an edge heading to the "${this}" node (= a value among "${[
                      ...referrersByName.keys(),
                    ].join(', ')}")`,
                    edgeEdgeConfig,
                    { path: originalEdgeConfigPath },
                  );
                }

                originalEdge = referrersByName.get(edgeEdgeConfig)!;
              } else {
                originalEdge = referrersByName.values().next().value;
              }

              referrersByName.delete(originalEdge.name);

              let reverseEdge: ReverseEdge;

              const kindConfig = reverseEdgeConfig.kind;
              const kindConfigPath = utils.addPath(
                reverseEdgeConfigPath,
                'kind',
              );

              if (originalEdge.isUnique()) {
                if (kindConfig != null && kindConfig !== 'Unique') {
                  throw new utils.UnexpectedValueError(
                    `"Unique" as the "${originalEdge}" edge is unique`,
                    kindConfig,
                    { path: kindConfigPath },
                  );
                }

                reverseEdge = new UniqueReverseEdge(
                  originalEdge,
                  reverseEdgeName,
                  reverseEdgeConfig as any,
                  reverseEdgeConfigPath,
                );
              } else {
                if (kindConfig != null && kindConfig !== 'Multiple') {
                  throw new utils.UnexpectedValueError(
                    `"Multiple" as the "${originalEdge}" edge is not unique`,
                    kindConfig,
                    { path: kindConfigPath },
                  );
                }

                reverseEdge = new MultipleReverseEdge(
                  originalEdge,
                  reverseEdgeName,
                  reverseEdgeConfig as any,
                  reverseEdgeConfigPath,
                );
              }

              return [...entries, [reverseEdge.name, reverseEdge]];
            },
            [],
            { path: reverseEdgesConfigPath },
          )
        : undefined,
    );

    const missingConfigs = Array.from(
      referrersByNameByNodeName.values(),
    ).flatMap((referrersByName) =>
      Array.from(referrersByName.values(), String),
    );

    if (missingConfigs.length) {
      throw new utils.GraphError(
        `Expects a configuration for the following referrer(s): ${missingConfigs.join(
          ', ',
        )}`,
        { path: reverseEdgesConfigPath },
      );
    }

    return reverseEdges;
  }

  @Memoize()
  public get reverseEdgeSet(): ReadonlySet<
    ReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    return new Set(this.reverseEdgesByName.values());
  }

  public getReverseEdgeByName(
    name: ReverseEdge['name'],
    path?: utils.Path,
  ): ReverseEdge<TRequestContext, TConnector, TContainer> {
    const reverseEdge = this.reverseEdgesByName.get(name);
    if (!reverseEdge) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s reverse-edge among "${[
          ...this.reverseEdgesByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return reverseEdge;
  }

  @Memoize()
  public get uniqueReverseEdgesByName(): ReadonlyMap<
    UniqueReverseEdge['name'],
    UniqueReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    return new Map(
      Array.from(this.reverseEdgesByName).filter(
        (entry): entry is [string, UniqueReverseEdge] =>
          entry[1] instanceof UniqueReverseEdge,
      ),
    );
  }

  @Memoize()
  public get uniqueReverseEdgeSet(): ReadonlySet<
    UniqueReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    return new Set(this.uniqueReverseEdgesByName.values());
  }

  public getUniqueReverseEdgeByName(
    name: UniqueReverseEdge['name'],
    path?: utils.Path,
  ): UniqueReverseEdge<TRequestContext, TConnector, TContainer> {
    const reverseEdge = this.uniqueReverseEdgesByName.get(name);
    if (!reverseEdge) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s unique-reverse-edge among "${[
          ...this.uniqueReverseEdgesByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return reverseEdge;
  }

  @Memoize()
  public get multipleReverseEdgesByName(): ReadonlyMap<
    MultipleReverseEdge['name'],
    MultipleReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    return new Map(
      Array.from(this.reverseEdgesByName).filter(
        (entry): entry is [string, MultipleReverseEdge] =>
          entry[1] instanceof MultipleReverseEdge,
      ),
    );
  }

  @Memoize()
  public get multipleReverseEdgeSet(): ReadonlySet<
    MultipleReverseEdge<TRequestContext, TConnector, TContainer>
  > {
    return new Set(this.multipleReverseEdgesByName.values());
  }

  public getMultipleReverseEdgeByName(
    name: MultipleReverseEdge['name'],
    path?: utils.Path,
  ): MultipleReverseEdge<TRequestContext, TConnector, TContainer> {
    const reverseEdge = this.multipleReverseEdgesByName.get(name);
    if (!reverseEdge) {
      throw new utils.UnexpectedValueError(
        `${this.indefinite}'s multiple-reverse-edge among "${[
          ...this.multipleReverseEdgesByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return reverseEdge;
  }

  @Memoize((onHeadDeletion: OnEdgeHeadDeletion) => onHeadDeletion)
  public getReverseEdgesByAction(
    onHeadDeletion: OnEdgeHeadDeletion,
  ): ReadonlyArray<ReverseEdge<TRequestContext, TConnector, TContainer>> {
    return Array.from(this.reverseEdgesByName.values()).filter(
      (reverseEdge) =>
        reverseEdge.originalEdge.onHeadDeletion === onHeadDeletion,
    );
  }

  @Memoize((onHeadDeletion: OnEdgeHeadDeletion) => onHeadDeletion)
  public getReverseEdgesByHeadByAction(
    onHeadDeletion: OnEdgeHeadDeletion,
  ): ReadonlyMap<
    Node<TRequestContext, TConnector, TContainer>,
    ReadonlyArray<ReverseEdge<TRequestContext, TConnector, TContainer>>
  > {
    const reverseEdgesByHead = new Map<Node, Array<ReverseEdge>>();

    for (const reverseEdge of this.getReverseEdgesByAction(onHeadDeletion)) {
      let reverseEdges = reverseEdgesByHead.get(reverseEdge.head);
      if (!reverseEdges) {
        reverseEdgesByHead.set(reverseEdge.head, (reverseEdges = []));
      }

      reverseEdges.push(reverseEdge);
    }

    return reverseEdgesByHead;
  }

  @Memoize()
  public get outputType(): NodeOutputType {
    return new NodeOutputType(this);
  }

  @Memoize()
  public get uniqueFilterInputType(): NodeUniqueFilterInputType {
    return new NodeUniqueFilterInputType(this);
  }

  @Memoize((edge: Edge) => edge)
  public getUniqueFilterWithoutEdgeInputType(
    edge: Edge,
  ): NodeUniqueFilterInputType {
    return new NodeUniqueFilterInputType(this, edge);
  }

  @Memoize()
  public get filterInputType(): NodeFilterInputType {
    return new NodeFilterInputType(this);
  }

  @Memoize()
  public get orderingInputType(): NodeOrderingInputType {
    return new NodeOrderingInputType(this);
  }

  @Memoize()
  public get creationInputType(): NodeCreationInputType {
    return new NodeCreationInputType(this);
  }

  @Memoize((edge: Edge) => edge)
  public getCreationWithoutEdgeInputType(edge: Edge): NodeCreationInputType {
    return new NodeCreationInputType(this, edge);
  }

  @Memoize()
  public get updateInputType(): NodeUpdateInputType {
    return new NodeUpdateInputType(this);
  }

  @Memoize((edge: Edge) => edge)
  public getUpdateWithoutEdgeInputType(edge: Edge): NodeUpdateInputType {
    return new NodeUpdateInputType(this, edge);
  }

  @Memoize()
  public get operationsByType(): Readonly<OperationsByType<TRequestContext>> {
    return Object.fromEntries(
      Object.entries(operationConstructorsByType).map(
        ([type, operationConstructors]) => [
          type,
          operationConstructors.map((constructor) => new constructor(this)),
        ],
      ),
    ) as any;
  }

  @Memoize()
  protected get operationsByKeyByType(): Readonly<
    OperationsByKeyByType<TRequestContext>
  > {
    return Object.fromEntries(
      Object.entries(this.operationsByType).map(([type, operations]) => [
        type,
        Object.fromEntries(
          operations.map((operation) => [operation.key, operation]),
        ),
      ]),
    ) as any;
  }

  public getOperationByTypeAndKey<
    TType extends keyof OperationsByKeyByType,
    TKey extends keyof OperationsByKeyByType[TType],
  >(
    type: TType,
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>[TType][TKey] {
    const operationsByKey = this.operationsByKeyByType[type];
    if (!operationsByKey) {
      throw new utils.UnexpectedValueError(
        `a type among "${Object.keys(this.operationsByKeyByType).join(', ')}"`,
        type,
        { path },
      );
    }

    const operation = operationsByKey[key];
    if (!operation) {
      throw new utils.UnexpectedValueError(
        `a key among "${Object.keys(operationsByKey).join(', ')}"`,
        key,
        { path },
      );
    }

    return operation;
  }

  public getMutationByKey<TKey extends keyof OperationsByKeyByType['mutation']>(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>['mutation'][TKey] {
    return this.getOperationByTypeAndKey(OperationTypeNode.MUTATION, key, path);
  }

  public getQueryByKey<TKey extends keyof OperationsByKeyByType['query']>(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>['query'][TKey] {
    return this.getOperationByTypeAndKey(OperationTypeNode.QUERY, key, path);
  }

  public getSubscriptionByKey<
    TKey extends keyof OperationsByKeyByType['subscription'],
  >(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>['subscription'][TKey] {
    return this.getOperationByTypeAndKey(
      OperationTypeNode.SUBSCRIPTION,
      key,
      path,
    );
  }

  @Memoize()
  protected get operationsByMethod(): Readonly<
    OperationsByMethod<TRequestContext>
  > {
    return Object.fromEntries(
      Object.values(this.operationsByType).flatMap((operations) =>
        operations.map((operation) => [operation.method, operation]),
      ),
    ) as any;
  }

  public getOperationByMethod<TMethod extends keyof OperationsByMethod>(
    method: TMethod,
    path?: utils.Path,
  ): OperationsByMethod<TRequestContext>[TMethod] {
    const operation = this.operationsByMethod[method];
    if (!operation) {
      throw new utils.UnexpectedValueError(
        `a method among "${Object.keys(this.operationsByMethod).join(', ')}"`,
        method,
        { path },
      );
    }

    return operation;
  }

  @Memoize()
  public validateDefinition(): void {
    utils.aggregateGraphError<Component, void>(
      this.componentSet,
      (_, component) => component.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    utils.aggregateGraphError<UniqueConstraint, void>(
      this.uniqueConstraintSet,
      (_, uniqueConstraint) => uniqueConstraint.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    this.selection;

    if (this.isUpdatable()) {
      if (
        !Array.from(this.componentSet).some((component) =>
          component.isMutable(),
        )
      ) {
        throw new utils.GraphError(
          `Expects at least one mutable component as it is mutable`,
          { path: this.configPath },
        );
      }
    }

    if (this.isPublic()) {
      if (
        !Array.from(this.componentSet).some((component) => component.isPublic())
      ) {
        throw new utils.GraphError(
          `Expects at least one public component as it is public`,
          { path: this.configPath },
        );
      }

      if (
        !Array.from(this.uniqueConstraintSet).some((uniqueConstraint) =>
          uniqueConstraint.isPublic(),
        )
      ) {
        throw new utils.GraphError(
          `Expects at least one public unique-constraint (= with all its components being public) as it is public`,
          { path: this.configPath },
        );
      }

      if (this.isPubliclyCreatable()) {
        if (
          !Array.from(this.componentSet).some((component) =>
            component.creationInput.isPublic(),
          )
        ) {
          throw new utils.GraphError(
            `Expects at least one public component as it is publicly creatable`,
            { path: this.configPath },
          );
        }
      }

      if (this.isPubliclyUpdatable()) {
        if (
          !Array.from(this.componentSet).some((component) =>
            component.updateInput?.isPublic(),
          )
        ) {
          throw new utils.GraphError(
            `Expects at least one publicly mutable component as it is publicly updatable`,
            { path: this.configPath },
          );
        }
      }
    }

    utils.aggregateGraphError<ReverseEdge, void>(
      this.reverseEdgesByName.values(),
      (_, reverseEdge) => reverseEdge.validateDefinition(),
      undefined,
      { path: this.configPath },
    );
  }

  @Memoize()
  public validateTypes(): void {
    utils.aggregateGraphError<Component, void>(
      this.componentSet,
      (_, component) => component.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    utils.aggregateGraphError<ReverseEdge, void>(
      this.reverseEdgesByName.values(),
      (_, reverseEdge) => reverseEdge.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    this.filterInputType.validate();
    this.orderingInputType.validate();
    this.uniqueFilterInputType.validate();
    this.isCreatable() && this.creationInputType.validate();
    this.isUpdatable() && this.updateInputType.validate();

    this.outputType.validate();
  }

  @Memoize()
  public validateOperations(): void {
    utils.aggregateGraphError<Operation, void>(
      Object.values(this.operationsByType).flat(),
      (_, operation) => operation.validate(),
      undefined,
      { path: this.configPath },
    );

    this.operationsByKeyByType;
    this.operationsByMethod;
  }

  public getAuthorization(
    context: OperationContext,
    mutationType?: utils.MutationType,
  ): NodeFilter | undefined {
    const authorization: NodeFilterInputValue | boolean | undefined =
      this.config.authorization?.call(this.gp, context.request, mutationType);

    return this.filterInputType.parseAndFilter(
      authorization === true
        ? undefined
        : authorization === false
        ? null
        : authorization,
    ).normalized;
  }

  @Memoize()
  public isScrollable(): boolean {
    return Array.from(this.uniqueConstraintSet).some((uniqueConstraint) =>
      uniqueConstraint.isScrollable(),
    );
  }

  public scroll<TValue extends NodeSelectedValue>(
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
    options?: NodeCursorOptions<TValue>,
  ): NodeCursor<TValue, TRequestContext> {
    return new NodeCursor(this, context, options);
  }

  public subscribe<
    TId extends UniqueConstraintValue,
    TValue extends NodeSelectedValue & TId,
  >(
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
    options?: NodeSubscriptionOptions<TValue>,
  ): NodeSubscription<TId, TValue, TRequestContext> {
    return new NodeSubscription(this, context, options);
  }

  public parseValue(maybeValue: unknown, path?: utils.Path): NodeValue {
    return this.selection.parseValue(maybeValue, path);
  }

  public areValuesEqual(a: NodeValue, b: NodeValue): boolean {
    return this.selection.areValuesEqual(a, b);
  }

  public uniqValues(values: ReadonlyArray<NodeValue>): NodeValue[] {
    return this.selection.uniqValues(values);
  }

  public serialize(maybeValue: unknown, path?: utils.Path): JsonObject {
    return this.selection.serialize(maybeValue, path);
  }

  public stringify(maybeValue: unknown, path?: utils.Path): string {
    return this.selection.stringify(maybeValue, path);
  }

  public filterChange(
    change: NodeChange<TRequestContext, TConnector, TContainer>,
  ): boolean {
    return this.#changeFilter ? this.#changeFilter(change) : true;
  }

  /**
   * Returns a "context"-bound API, so you only have to provide the operations' args:
   *
   * @example
   * const articles = await api.findMany({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  public createContextBoundAPI(
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
  ): ContextBoundNodeAPI {
    return createContextBoundNodeAPI(this, context);
  }
}
