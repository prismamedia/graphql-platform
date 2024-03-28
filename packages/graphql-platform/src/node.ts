import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import * as R from 'remeda';
import type { Constructor, Except, Promisable } from 'type-fest';
import type { BrokerInterface } from './broker-interface.js';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';
import type { NodeChange } from './node/change.js';
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
import { NodeFeature, type NodeFeatureConfig } from './node/feature.js';
import { assertNodeName, type NodeName } from './node/name.js';
import {
  constructCustomOperation,
  createContextBoundNodeAPI,
  createNodeAPI,
  operationConstructorsByType,
  type ContextBoundNodeAPI,
  type CreationConfig,
  type CustomOperationConstructor,
  type DeletionConfig,
  type MutationConfig,
  type NodeAPI,
  type Operation,
  type OperationByType,
  type OperationContext,
  type OperationType,
  type OperationsByType,
  type PostCreateArgs,
  type PostDeleteArgs,
  type PostUpdateArgs,
  type PreCreateArgs,
  type PreDeleteArgs,
  type PreUpdateArgs,
  type UpdateConfig,
} from './node/operation.js';
import {
  NodeSelection,
  mergeSelectionExpressions,
  type NodeFilter,
  type NodeSelectedValue,
} from './node/statement.js';
import {
  NodeCreationInputType,
  NodeFilterInputType,
  NodeOrderingInputType,
  NodeOutputType,
  NodeUniqueFilterInputType,
  NodeUpdateInputType,
  type NodeFilterInputValue,
  type NodeOutputTypeConfig,
} from './node/type.js';

export * from './node/change.js';
export * from './node/definition.js';
export * from './node/feature.js';
export * from './node/fixture.js';
export * from './node/loader.js';
export * from './node/name.js';
export * from './node/operation.js';
export * from './node/statement.js';
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

export type NodeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
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
   * Optional, you can provide a set of features, an easy way to share some common configurations, including components, uniques, hooks...
   */
  features?: NodeFeatureConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >[];

  /**
   * A component is either a leaf (= an enum or a scalar) or an edge (= a link to another node)
   *
   * At least one must be defined
   */
  components?: {
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
  uniques?: UniqueConstraintConfig<TConnector>[];

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
  output?: NodeOutputTypeConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  /**
   * Optional, fine-tune the "query"
   */
  query?: {
    /**
     * Optional, add some custom-queries
     */
    customs?: CustomOperationConstructor<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >[];
  };

  /**
   * Optional, fine-tune the "mutation":
   *
   * - "true" means all the "mutations" are enabled
   * - "false" means all the "mutations" are disabled
   */
  mutation?:
    | boolean
    | ({
        [TType in keyof MutationConfig]?:
          | boolean
          | MutationConfig<
              TRequestContext,
              TConnector,
              TBroker,
              TContainer
            >[TType];
      } & {
        /**
         * Optional, add some custom-mutations
         */
        customs?: CustomOperationConstructor<
          TRequestContext,
          TConnector,
          TBroker,
          TContainer
        >[];
      });

  /**
   * Optional, fine-tune the access to these nodes, given the request-context and the access-type among "query" (= !mutationType) / "creation" / "update" / "deletion":
   * - deny all access by returning either "false" or "null"
   * - grant full access by returning either "true" or "undefined"
   * - grant access to a subset by returning a filter (= the "where" argument)
   */
  authorization?: (
    this: Node<TRequestContext, TConnector, TBroker, TContainer>,
    requestContext: TRequestContext,
    mutationType?: utils.MutationType,
  ) => NodeFilterInputValue | boolean;

  /**
   * Optional, you may want to filter the "changes" to avoid some useless processing in the "change-aggregation" and "change" listeners
   */
  changeFilter?: (
    this: Node<TRequestContext, TConnector, TBroker, TContainer>,
    change: NodeChange<TRequestContext>,
  ) => boolean;

  /**
   * Optional, register a change-aggregation-listener
   */
  onChangeAggregation?: (
    this: Node<TRequestContext, TConnector, TBroker, TContainer>,
    changes: ReadonlyArray<NodeChange<TRequestContext>>,
  ) => Promisable<void>;

  /**
   * Optional, register a change-listener
   */
  onChange?: (
    this: Node<TRequestContext, TConnector, TBroker, TContainer>,
    change: NodeChange<TRequestContext>,
  ) => Promisable<void>;
} & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.NODE>;

export class Node<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> {
  public readonly plural: string;
  public readonly indefinite: string;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;

  public readonly priority: number;

  public readonly features: ReadonlyArray<
    | Node<TRequestContext, TConnector, TBroker, TContainer>
    | NodeFeature<TRequestContext, TConnector, TBroker, TContainer>
  >;

  public readonly featuresByPriority: ReadonlyMap<
    number,
    ReadonlyArray<
      | Node<TRequestContext, TConnector, TBroker, TContainer>
      | NodeFeature<TRequestContext, TConnector, TBroker, TContainer>
    >
  >;

  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TConnector>
  >;

  public readonly componentSet: ReadonlySet<Component<TConnector>>;

  public readonly leavesByName: ReadonlyMap<Leaf['name'], Leaf<TConnector>>;

  public readonly leafSet: ReadonlySet<Leaf<TConnector>>;

  public readonly edgesByName: ReadonlyMap<Edge['name'], Edge<TConnector>>;

  public readonly edgeSet: ReadonlySet<Edge<TConnector>>;

  public readonly uniqueConstraintsByName: ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint<TConnector>
  >;

  public readonly uniqueConstraintSet: ReadonlySet<
    UniqueConstraint<TConnector>
  >;

  /**
   * An identifier is a non-nullable and immutable unique-constraint
   */
  public readonly identifierSet: ReadonlySet<UniqueConstraint<TConnector>>;

  public readonly mainIdentifier: UniqueConstraint<TConnector>;

  readonly #changeFilter?: (change: NodeChange<TRequestContext>) => boolean;

  public constructor(
    public readonly gp: GraphQLPlatform<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,
    public readonly name: NodeName,
    public readonly config: NodeConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,
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

    this.priority = 0;

    // features
    {
      const featuresConfig = config.features;
      const featuresConfigPath = utils.addPath(configPath, 'features');

      const features = utils
        .ensureNillableArray<NodeFeatureConfig>(
          featuresConfig,
          featuresConfigPath,
        )
        ?.map(
          (config, index) =>
            new NodeFeature(
              this,
              config,
              utils.addPath(featuresConfigPath, index),
            ),
        );

      this.features = features
        ? R.sortBy([...features, this], [({ priority }) => priority, 'desc'])
        : [this];

      this.featuresByPriority = new Map(
        R.pipe(
          this.features,
          R.groupBy(({ priority }) => priority),
          R.values,
          R.map((nodeOrFeatures) => [
            nodeOrFeatures[0].priority,
            nodeOrFeatures,
          ]),
        ),
      );
    }

    // components
    {
      const componentsConfig = config.components;
      const componentsConfigPath = utils.addPath(configPath, 'components');

      this.componentsByName = new Map(
        this.features.flatMap(({ config, configPath }) => {
          const componentsConfig = config.components;
          const componentsConfigPath = utils.addPath(configPath, 'components');

          utils.assertNillablePlainObject(
            componentsConfig,
            componentsConfigPath,
          );

          return componentsConfig
            ? utils.aggregateGraphError<
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
                  const kindConfigPath = utils.addPath(
                    componentConfigPath,
                    'kind',
                  );

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
              )
            : [];
        }),
      );

      if (!this.componentsByName.size) {
        throw new utils.UnexpectedValueError(
          `at least one component`,
          componentsConfig,
          { path: componentsConfigPath },
        );
      }

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

      this.uniqueConstraintsByName = new Map(
        this.features.flatMap(({ config, configPath }) => {
          const uniquesConfig = config.uniques;
          const uniquesConfigPath = utils.addPath(configPath, 'uniques');

          utils.assertNillableArray(uniquesConfig, uniquesConfigPath);

          return uniquesConfig
            ? utils.aggregateGraphError<
                UniqueConstraintConfig,
                [UniqueConstraint['name'], UniqueConstraint][]
              >(
                uniquesConfig,
                (entries, uniqueConfig, index) => {
                  const uniqueConstraint = new UniqueConstraint(
                    this,
                    uniqueConfig,
                    utils.addPath(uniquesConfigPath, index),
                  );

                  return [
                    ...entries,
                    [uniqueConstraint.name, uniqueConstraint],
                  ];
                },
                [],
                { path: uniquesConfigPath },
              )
            : [];
        }),
      );

      if (!this.uniqueConstraintsByName.size) {
        throw new utils.UnexpectedValueError(
          `at least one unique-constraint`,
          uniquesConfig,
          { path: uniquesConfigPath },
        );
      }

      this.uniqueConstraintSet = new Set(this.uniqueConstraintsByName.values());

      // identifiers (= non-nullable and immutable unique-constraints)
      {
        this.identifierSet = new Set(
          Array.from(this.uniqueConstraintSet).filter((uniqueConstraint) =>
            uniqueConstraint.isIdentifier(),
          ),
        );

        if (!this.identifierSet.size) {
          throw new utils.UnexpectedValueError(
            `at least one identifier (= a non-nullable and immutable unique-constraint)`,
            uniquesConfig,
            { path: uniquesConfigPath },
          );
        }

        {
          const mainIdentifierConfigPath = utils.addPath(uniquesConfigPath, 0);

          this.mainIdentifier = Array.from(this.uniqueConstraintSet)[0];

          if (this.mainIdentifier.isNullable()) {
            throw new utils.GraphError(
              `Expects its main-identifier (= the first unique-constraint, composed of the component${
                this.mainIdentifier.isComposite() ? 's' : ''
              } "${[...this.mainIdentifier.componentsByName.keys()].join(
                ', ',
              )}") to be non-nullable (= at least one of its components being non-nullable)`,
              { path: mainIdentifierConfigPath },
            );
          }

          if (this.mainIdentifier.isMutable()) {
            throw new utils.GraphError(
              `Expects its main-identifier (= the first unique-constraint, composed of the component${
                this.mainIdentifier.isComposite() ? 's' : ''
              } "${[...this.mainIdentifier.componentsByName.keys()].join(
                ', ',
              )}") to be immutable (= all its components being immutable)`,
              { path: mainIdentifierConfigPath },
            );
          }
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
    config?: MutationConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >[TType];
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

  public isPubliclyCreatable(): boolean {
    return this.isPubliclyMutable(utils.MutationType.CREATION);
  }

  public isPubliclyUpdatable(): boolean {
    return this.isPubliclyMutable(utils.MutationType.UPDATE);
  }

  public isPubliclyDeletable(): boolean {
    return this.isPubliclyMutable(utils.MutationType.DELETION);
  }

  @Memoize()
  public get preCreateHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<CreationConfig['preCreate']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.CREATION)
                  .config?.preCreate,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async preCreate(
    args: Except<PreCreateArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.preCreateHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  @Memoize()
  public get postCreateHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<CreationConfig['postCreate']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.CREATION)
                  .config?.postCreate,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async postCreate(
    args: Except<PostCreateArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.postCreateHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  @Memoize()
  public get preUpdateHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<UpdateConfig['preUpdate']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.UPDATE)
                  .config?.preUpdate,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async preUpdate(
    args: Except<PreUpdateArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.preUpdateHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  @Memoize()
  public get postUpdateHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<UpdateConfig['postUpdate']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.UPDATE)
                  .config?.postUpdate,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async postUpdate(
    args: Except<PostUpdateArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.postUpdateHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  @Memoize()
  public get preDeleteHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<DeletionConfig['preDelete']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.DELETION)
                  .config?.preDelete,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async preDelete(
    args: Except<PreDeleteArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.preDeleteHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  @Memoize()
  public get postDeleteHooksByPriority(): ReadonlyMap<
    number,
    ReadonlyArray<NonNullable<DeletionConfig['postDelete']>>
  > {
    return new Map(
      Array.from(
        this.featuresByPriority,
        ([priority, nodeOrFeatures]): [number, Array<any>] => [
          priority,
          nodeOrFeatures
            .map(
              (featureOrNode) =>
                featureOrNode.getMutationConfig(utils.MutationType.DELETION)
                  .config?.postDelete,
            )
            .filter(R.isFunction),
        ],
      ).filter(([, hooks]) => hooks.length),
    );
  }

  public async postDelete(
    args: Except<PostDeleteArgs<any, any, any, any>, 'gp' | 'node' | 'api'>,
  ): Promise<void> {
    for (const [_priority, hooks] of this.postDeleteHooksByPriority) {
      await Promise.all(
        hooks.map((hook) =>
          hook({
            gp: this.gp,
            node: this,
            api: args.context.api,
            ...args,
          }),
        ),
      );
    }
  }

  public getComponentByName(
    name: Component['name'],
    path?: utils.Path,
  ): Component<TConnector> {
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
  ): Component<TConnector> {
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
  ): Leaf<TConnector> {
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
  ): Leaf<TConnector> {
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
  ): Edge<TConnector> {
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
  ): Edge<TConnector> {
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
  ): UniqueConstraint<TConnector> {
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
    ReverseEdge<TConnector>
  > {
    const reverseEdgesConfig = this.config.reverseEdges;
    const reverseEdgesConfigPath = utils.addPath(
      this.configPath,
      'reverseEdges',
    );

    utils.assertNillablePlainObject(reverseEdgesConfig, reverseEdgesConfigPath);

    // Let's find all the edges heading to this node
    const referrers = new Set(
      Array.from(this.gp.nodeSet).flatMap((node) =>
        Array.from(node.edgeSet).filter((edge) => edge.head === this),
      ),
    );

    if (
      !referrers.size &&
      utils.isPlainObject(reverseEdgesConfig) &&
      Object.entries(reverseEdgesConfig).length
    ) {
      throw new utils.UnexpectedValueError(
        `no configuration as there is no node heading to this "${this}" node`,
        reverseEdgesConfig,
        { path: reverseEdgesConfigPath },
      );
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

              const [nodeName, edgeName] = originalEdgeConfig.split('.');

              const originalEdge = Array.from(referrers).find(
                (referrer) =>
                  referrer.tail.name === nodeName &&
                  (!edgeName || referrer.name === edgeName),
              );

              if (!originalEdge) {
                throw new utils.UnexpectedValueError(
                  `${
                    edgeName ? `an edge` : `a node`
                  } heading to this "${this}" node`,
                  originalEdgeConfig,
                  { path: originalEdgeConfigPath },
                );
              } else {
                referrers.delete(originalEdge);
              }

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

    if (referrers.size) {
      throw new utils.GraphError(
        `Expects a configuration for the following referrer(s): ${Array.from(
          referrers,
          String,
        ).join(', ')}`,
        { path: reverseEdgesConfigPath },
      );
    }

    return reverseEdges;
  }

  @Memoize()
  public get reverseEdgeSet(): ReadonlySet<ReverseEdge<TConnector>> {
    return new Set(this.reverseEdgesByName.values());
  }

  public getReverseEdgeByName(
    name: ReverseEdge['name'],
    path?: utils.Path,
  ): ReverseEdge<TConnector> {
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
    UniqueReverseEdge<TConnector>
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
    UniqueReverseEdge<TConnector>
  > {
    return new Set(this.uniqueReverseEdgesByName.values());
  }

  public getUniqueReverseEdgeByName(
    name: UniqueReverseEdge['name'],
    path?: utils.Path,
  ): UniqueReverseEdge<TConnector> {
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
    MultipleReverseEdge<TConnector>
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
    MultipleReverseEdge<TConnector>
  > {
    return new Set(this.multipleReverseEdgesByName.values());
  }

  public getMultipleReverseEdgeByName(
    name: MultipleReverseEdge['name'],
    path?: utils.Path,
  ): MultipleReverseEdge<TConnector> {
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
  public getReverseEdgesByActionOnOriginalEdgeDeletion(
    onHeadDeletion: OnEdgeHeadDeletion,
  ): ReadonlyArray<ReverseEdge<TConnector>> {
    return Array.from(this.reverseEdgeSet).filter(
      (reverseEdge) =>
        reverseEdge.originalEdge.onHeadDeletion === onHeadDeletion,
    );
  }

  @Memoize((onHeadDeletion: OnEdgeHeadDeletion) => onHeadDeletion)
  public getReverseEdgesByHeadByActionOnOriginalEdgeDeletion(
    onHeadDeletion: OnEdgeHeadDeletion,
  ): ReadonlyMap<
    Node<TRequestContext, TConnector, TBroker, TContainer>,
    ReadonlyArray<ReverseEdge<TConnector>>
  > {
    const reverseEdgesByHead = new Map<Node, Array<ReverseEdge>>();

    for (const reverseEdge of this.getReverseEdgesByActionOnOriginalEdgeDeletion(
      onHeadDeletion,
    )) {
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
      utils.operationTypes.map((type) => {
        const operations: Operation[] = [];

        operationConstructorsByType[type]?.forEach(
          (constructor: Constructor<Operation, [Node]>) =>
            operations.push(new constructor(this)),
        );

        if (type === graphql.OperationTypeNode.QUERY) {
          this.features.forEach(({ config: { query } }) => {
            if (Array.isArray(query?.customs)) {
              operations.push(
                ...query.customs.map((constructor) =>
                  constructCustomOperation(constructor, this, type),
                ),
              );
            }
          });
        } else if (type === graphql.OperationTypeNode.MUTATION) {
          this.features.forEach(({ config: { mutation } }) => {
            if (R.isPlainObject(mutation) && Array.isArray(mutation.customs)) {
              operations.push(
                ...mutation.customs.map((constructor) =>
                  constructCustomOperation(constructor, this, type),
                ),
              );
            }
          });
        }

        return [type, operations];
      }),
    ) as any;
  }

  @Memoize()
  public get operationsByKeyByType(): Readonly<
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

  public getMutationByKey<
    TKey extends keyof OperationsByKeyByType[graphql.OperationTypeNode.MUTATION],
  >(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>[graphql.OperationTypeNode.MUTATION][TKey] {
    return this.getOperationByTypeAndKey(
      graphql.OperationTypeNode.MUTATION,
      key,
      path,
    );
  }

  public getQueryByKey<
    TKey extends keyof OperationsByKeyByType[graphql.OperationTypeNode.QUERY],
  >(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>[graphql.OperationTypeNode.QUERY][TKey] {
    return this.getOperationByTypeAndKey(
      graphql.OperationTypeNode.QUERY,
      key,
      path,
    );
  }

  public getSubscriptionByKey<
    TKey extends keyof OperationsByKeyByType[graphql.OperationTypeNode.SUBSCRIPTION],
  >(
    key: TKey,
    path?: utils.Path,
  ): OperationsByKeyByType<TRequestContext>[graphql.OperationTypeNode.SUBSCRIPTION][TKey] {
    return this.getOperationByTypeAndKey(
      graphql.OperationTypeNode.SUBSCRIPTION,
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

    this.preCreateHooksByPriority;
    this.postCreateHooksByPriority;
    this.preUpdateHooksByPriority;
    this.postUpdateHooksByPriority;
    this.preDeleteHooksByPriority;
    this.postDeleteHooksByPriority;
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

    if (this.isPublic() && !this.uniqueFilterInputType.isPublic()) {
      throw new utils.GraphError(
        `Expects to be publicly identifiable as it is public`,
        { path: this.configPath },
      );
    }
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
    const authorization: NodeFilterInputValue | boolean =
      this.config.authorization?.call(this, context.request, mutationType);

    return this.filterInputType.parseAndFilter(
      authorization === true
        ? undefined
        : authorization === false
        ? null
        : authorization,
    ).normalized;
  }

  public filterChange(change: NodeChange<TRequestContext>): boolean {
    return this.#changeFilter?.(change) ?? true;
  }

  /**
   * Make it easy to call the operations:
   *
   * @example
   * const articles = await api.findMany(myRequestContext, { where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  @Memoize()
  public get api(): NodeAPI<TRequestContext> {
    return createNodeAPI(this);
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
