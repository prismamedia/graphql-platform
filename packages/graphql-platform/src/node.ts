import {
  addPath,
  aggregateConfigError,
  aggregateError,
  assertPlainObjectConfig,
  castToError,
  ConfigError,
  ensureName,
  getOptionalDeprecation,
  getOptionalDescription,
  getOptionalFlag,
  indefinite,
  isPlainObject,
  MutationType,
  UnexpectedConfigError,
  UnexpectedValueError,
  UnreachableConfigError,
  type Name,
  type OptionalDeprecation,
  type OptionalDescription,
  type OptionalFlag,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import * as rxjs from 'rxjs';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';
import type { ChangedNode } from './node/change.js';
import {
  Edge,
  Leaf,
  ReverseEdgeMultiple,
  ReverseEdgeUnique,
  UniqueConstraint,
  type Component,
  type ComponentConfig,
  type ComponentValue,
  type ReverseEdge,
  type ReverseEdgeConfig,
  type UniqueConstraintConfig,
  type UniqueConstraintValue,
} from './node/definition.js';
import { assertNodeName, type NodeName } from './node/name.js';
import {
  mutationConstructorsByKey,
  nodeSubscriptionConstructorsByKey,
  queryConstructorsByKey,
  UnauthorizedError,
  type MutationConfig,
  type MutationInterface,
  type MutationKey,
  type MutationsByKey,
  type NodeSubscriptionKey,
  type NodeSubscriptionsByKey,
  type OperationInterface,
  type QueriesByKey,
  type QueryKey,
} from './node/operation.js';
import {
  mergeSelectionExpressions,
  NodeFilter,
  NodeSelection,
  type NodeSelectedValue,
} from './node/statement.js';
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
export * from './node/definition.js';
export * from './node/fixture.js';
export * from './node/name.js';
export * from './node/operation.js';
export * from './node/statement.js';
export * from './node/type.js';

/**
 * Includes all the components' value
 *
 * -> think of a "row" in SQL or a "document" in NoSQL
 */
export type NodeValue = NodeSelectedValue &
  UniqueConstraintValue & {
    [componentName: string]: ComponentValue;
  };

export type NodeAuthorizationConfig<TRequestContext extends object> = (
  requestContext: TRequestContext,
  mutationType?: MutationType,
) => boolean | NodeFilterInputValue;

export type NodeConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
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
  description?: OptionalDescription;

  /**
   * Optional, either this node is deprecated or not
   *
   * The information will be shown in all its operations
   */
  deprecated?: OptionalDeprecation;

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
    [componentName: Name]: ComponentConfig<TRequestContext, TConnector>;
  };

  /**
   * Define the unique constraints for this node
   *
   * At least one must be defined
   *
   * The first one will become this node's identifier, a special unique constraint with some additional restrictions, it must be:
   *  - non-nullable (= at least one of its components being non-nullable)
   *  - immutable (= all its components being immutable)
   */
  uniques: UniqueConstraintConfig<TRequestContext, TConnector>[];

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
    [reverseEdge: Name]: ReverseEdgeConfig<TRequestContext, TConnector>;
  };

  /**
   * Optional, either the node is exposed publicly (in the GraphQL API) or not (only available internally)
   *
   * Default: true
   */
  public?: OptionalFlag;

  /**
   * Optional, fine-tune the output type generated from this node's definition
   */
  output?: NodeOutputTypeConfig<TRequestContext, TConnector>;

  /**
   * Optional, fine-tune the "mutation":
   *
   * - "true" means all the "mutations" are enabled
   * - "false" means all the "mutations" are disabled
   */
  mutation?:
    | boolean
    | {
        [TType in keyof MutationConfig<TRequestContext, TConnector>]?:
          | boolean
          | MutationConfig<TRequestContext, TConnector>[TType];
      };

  /**
   * Optional, fine-tune the access to this node given the request-context and the access-type among: query (= !mutationType) / creation / update / deletion
   *
   * Either it can proceed (= true or undefined) or an UnauthorizedError is thrown (= false or null)
   *
   * A third option is possible: it is to return a filter (= the "where" argument), it will restrict the client's operation to a subset of the nodes
   */
  authorization?: NodeAuthorizationConfig<TRequestContext>;

  /**
   * Optional, subscribe to this node's changes Observable
   */
  onChange?: (change: ChangedNode<TRequestContext, TConnector>) => void;
} & GetConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.NODE>;

export class Node<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly plural: string;
  public readonly indefinite: string;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;
  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector>
  >;
  public readonly leavesByName: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector>
  >;
  public readonly edgesByName: ReadonlyMap<
    Edge['name'],
    Edge<TRequestContext, TConnector>
  >;
  public readonly uniqueConstraintsByName: ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint<TRequestContext, TConnector>
  >;
  public readonly identifier: UniqueConstraint<TRequestContext, TConnector>;
  readonly #authorizationConfig?: NodeAuthorizationConfig<TRequestContext>;
  readonly #authorizationConfigPath: Path;

  /**
   * An Observable of this node's changes
   */
  public readonly changes = new rxjs.Subject<
    ChangedNode<TRequestContext, TConnector>
  >();

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,
    public readonly name: NodeName,
    public readonly config: NodeConfig<TRequestContext, TConnector>,
    public readonly configPath: Path,
  ) {
    assertNodeName(name, configPath);
    assertPlainObjectConfig(config, configPath);

    // plural
    {
      const pluralConfig = config.plural;
      const pluralConfigPath = addPath(configPath, 'plural');

      this.plural = ensureName(
        pluralConfig ?? inflection.pluralize(name),
        pluralConfigPath,
      );

      const pascalCasedPlural = inflection.camelize(this.plural, false);
      if (this.plural !== pascalCasedPlural) {
        throw new UnexpectedConfigError(
          `a "plural" form in PascalCase (= "${pascalCasedPlural}")`,
          pluralConfig,
          { path: pluralConfigPath },
        );
      }

      if (name === this.plural) {
        throw new UnexpectedConfigError(
          `differents "singular" and "plural" forms, you have to define the "plural" parameter as we were not able to guess a valid one`,
          pluralConfig,
          { path: pluralConfigPath },
        );
      }
    }

    // indefinite
    {
      this.indefinite = indefinite(name);
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = addPath(configPath, 'description');

      this.description = getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }

    // deprecated
    {
      const deprecatedConfig = config.deprecated;
      const deprecatedConfigPath = addPath(configPath, 'deprecated');

      this.deprecationReason = getOptionalDeprecation(
        deprecatedConfig,
        `The "${this.name}" node is deprecated`,
        deprecatedConfigPath,
      );
    }

    // components
    {
      const componentsConfig = config.components;
      const componentsConfigPath = addPath(configPath, 'components');

      if (
        !isPlainObject(componentsConfig) ||
        !Object.entries(componentsConfig).length
      ) {
        throw new UnexpectedConfigError(
          `at least one "component"`,
          componentsConfig,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        aggregateConfigError<
          [Component['name'], ComponentConfig<any, any>],
          [Component['name'], Component][]
        >(
          Object.entries(componentsConfig),
          (entries, [componentName, componentConfig]) => {
            const componentConfigPath = addPath(
              componentsConfigPath,
              componentName,
            );

            assertPlainObjectConfig(componentConfig, componentConfigPath);

            let component: Component;

            const kindConfig = componentConfig.kind;
            const kindConfigPath = addPath(componentConfigPath, 'kind');

            if (kindConfig === 'Leaf') {
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
              throw new UnreachableConfigError(kindConfig, {
                path: kindConfigPath,
              });
            }

            return [...entries, [component.name, component]];
          },
          [],
          { path: componentsConfigPath },
        ),
      );

      this.leavesByName = new Map(
        Array.from(this.componentsByName).filter(
          (entry): entry is [string, Leaf] => entry[1] instanceof Leaf,
        ),
      );

      this.edgesByName = new Map(
        Array.from(this.componentsByName).filter(
          (entry): entry is [string, Edge] => entry[1] instanceof Edge,
        ),
      );
    }

    // uniques
    {
      const uniquesConfig = config.uniques;
      const uniquesConfigPath = addPath(configPath, 'uniques');

      if (!Array.isArray(uniquesConfig) || !uniquesConfig.length) {
        throw new UnexpectedConfigError(
          `at least one "unique-constraint"`,
          uniquesConfig,
          { path: uniquesConfigPath },
        );
      }

      this.uniqueConstraintsByName = new Map(
        aggregateConfigError<
          UniqueConstraintConfig<any, any>,
          [UniqueConstraint['name'], UniqueConstraint][]
        >(
          uniquesConfig,
          (entries, uniqueConstraintConfig, index) => {
            const unique = new UniqueConstraint(
              this,
              uniqueConstraintConfig,
              addPath(uniquesConfigPath, index),
            );

            return [...entries, [unique.name, unique]];
          },
          [],
          { path: uniquesConfigPath },
        ),
      );

      // identifier (= the first unique constraint)
      {
        const identifierConfigPath = addPath(uniquesConfigPath, 0);

        this.identifier = this.uniqueConstraintsByName.values().next().value;

        if (this.identifier.isNullable()) {
          throw new ConfigError(
            `Expects its identifier (= the first unique constraint, composed of the component${
              this.identifier.composite ? 's' : ''
            } "${[...this.identifier.componentsByName.keys()].join(
              ', ',
            )}") to be non-nullable (= at least one of its components being non-nullable)`,
            { path: identifierConfigPath },
          );
        }

        if (this.identifier.isMutable()) {
          throw new ConfigError(
            `Expects its identifier (= the first unique constraint, composed of the component${
              this.identifier.composite ? 's' : ''
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
      const authorizationConfigPath = addPath(configPath, 'authorization');

      if (
        authorizationConfig !== undefined &&
        typeof authorizationConfig !== 'function'
      ) {
        throw new UnexpectedConfigError(
          `a request-authorizer`,
          authorizationConfig,
          { path: authorizationConfigPath },
        );
      }

      this.#authorizationConfig = authorizationConfig;
      this.#authorizationConfigPath = authorizationConfigPath;
    }

    config.onChange && this.changes.subscribe(config.onChange);
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = addPath(this.configPath, 'public');

    return getOptionalFlag(publicConfig, true, publicConfigPath);
  }

  @Memoize((mutationType: MutationType) => mutationType)
  public getMutationConfig<TType extends MutationType>(
    mutationType: TType,
  ): {
    config?: MutationConfig<TRequestContext, TConnector>[TType];
    configPath: Path;
  } {
    const mutationsConfig = this.config.mutation;
    const mutationsConfigPath = addPath(this.configPath, 'mutation');

    if (typeof mutationsConfig === 'boolean') {
      return {
        config: { enabled: mutationsConfig },
        configPath: mutationsConfigPath,
      };
    } else if (isPlainObject(mutationsConfig)) {
      const mutationConfig = mutationsConfig[mutationType];
      const mutationConfigPath = addPath(mutationsConfigPath, mutationType);

      if (typeof mutationConfig === 'boolean') {
        return {
          config: { enabled: mutationConfig },
          configPath: mutationConfigPath,
        };
      } else if (isPlainObject(mutationConfig)) {
        return {
          config: mutationConfig,
          configPath: mutationConfigPath,
        };
      } else if (mutationConfig != null) {
        throw new UnexpectedConfigError(
          `a boolean or a plain-object`,
          mutationConfig,
          { path: mutationConfigPath },
        );
      }
    } else if (mutationsConfig != null) {
      throw new UnexpectedConfigError(
        `a boolean or a plain-object`,
        mutationsConfig,
        { path: mutationsConfigPath },
      );
    }

    return {
      configPath: mutationsConfigPath,
    };
  }

  @Memoize((mutationType: MutationType) => mutationType)
  public isMutationEnabled(mutationType: MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    return getOptionalFlag(
      config?.enabled,
      true,
      addPath(configPath, 'enabled'),
    );
  }

  @Memoize((mutationType: MutationType) => mutationType)
  public isMutationPublic(mutationType: MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    const publicConfig = config?.public;
    const publicConfigPath = addPath(configPath, 'public');

    const isPublic = getOptionalFlag(
      publicConfig,
      this.isPublic() && this.isMutationEnabled(mutationType),
      publicConfigPath,
    );

    if (isPublic) {
      if (!this.isPublic()) {
        throw new UnexpectedConfigError(
          `not to be "true" as the "${this}" node is private`,
          publicConfig,
          { path: publicConfigPath },
        );
      }

      if (!this.isMutationEnabled(mutationType)) {
        throw new UnexpectedConfigError(
          `not to be "true" as the "${this}" node's ${mutationType} is disabled`,
          publicConfig,
          { path: publicConfigPath },
        );
      }
    }

    return isPublic;
  }

  public getComponentByName(
    name: Component['name'],
    path?: Path,
  ): Component<TRequestContext, TConnector> {
    const component = this.componentsByName.get(name);
    if (!component) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s component among "${[
          ...this.componentsByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return component;
  }

  public getLeafByName(
    name: Leaf['name'],
    path?: Path,
  ): Leaf<TRequestContext, TConnector> {
    const leaf = this.leavesByName.get(name);
    if (!leaf) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s leaf among "${[...this.leavesByName.keys()].join(
          ', ',
        )}"`,
        name,
        { path },
      );
    }

    return leaf;
  }

  public getEdgeByName(
    name: Edge['name'],
    path?: Path,
  ): Edge<TRequestContext, TConnector> {
    const edge = this.edgesByName.get(name);
    if (!edge) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s edge among "${[...this.edgesByName.keys()].join(
          ', ',
        )}"`,
        name,
        { path },
      );
    }

    return edge;
  }

  public getUniqueConstraintByName(
    name: UniqueConstraint['name'],
    path?: Path,
  ): UniqueConstraint<TRequestContext, TConnector> {
    const uniqueConstraint = this.uniqueConstraintsByName.get(name);
    if (!uniqueConstraint) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s unique-constraint among "${[
          ...this.uniqueConstraintsByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return uniqueConstraint;
  }

  @Memoize()
  public get selection(): NodeSelection<NodeValue> {
    return new NodeSelection(
      this,
      mergeSelectionExpressions(
        Array.from(
          this.componentsByName.values(),
          ({ selection }) => selection,
        ),
      ),
    );
  }

  @Memoize()
  public get reverseEdgesByName(): ReadonlyMap<
    ReverseEdge['name'],
    ReverseEdge<TRequestContext, TConnector>
  > {
    // Let's find all the edges heading to this node
    const referrersByNameByNodeName = new Map<
      Node['name'],
      Map<Edge['name'], Edge>
    >(
      [...this.gp.nodesByName.values()]
        .map((node): [Node['name'], Map<Edge['name'], Edge>] => [
          node.name,
          new Map(
            [...node.edgesByName].filter(([, edge]) => edge.head === this),
          ),
        ])
        .filter(([, referrersByName]) => referrersByName.size),
    );

    const reverseEdgesConfig = this.config.reverseEdges;
    const reverseEdgesConfigPath = addPath(this.configPath, 'reverseEdges');

    // No reverse-edge
    if (!referrersByNameByNodeName.size) {
      if (
        reverseEdgesConfig != null &&
        (!isPlainObject(reverseEdgesConfig) ||
          Object.entries(reverseEdgesConfig).length)
      ) {
        throw new UnexpectedConfigError(
          `no configuration as there is no node having an edge heading to the "${this}" node`,
          reverseEdgesConfig,
          { path: reverseEdgesConfigPath },
        );
      }

      return new Map();
    }

    assertPlainObjectConfig(reverseEdgesConfig, reverseEdgesConfigPath);

    const reverseEdges = new Map(
      reverseEdgesConfig
        ? aggregateConfigError<
            [ReverseEdge['name'], ReverseEdgeConfig<any, any>],
            [ReverseEdge['name'], ReverseEdge][]
          >(
            Object.entries(reverseEdgesConfig),
            (entries, [reverseEdgeName, reverseEdgeConfig]) => {
              const reverseEdgeConfigPath = addPath(
                reverseEdgesConfigPath,
                reverseEdgeName,
              );

              if (this.componentsByName.has(reverseEdgeName)) {
                throw new UnexpectedConfigError(
                  `a "name" not among "${[...this.componentsByName.keys()].join(
                    ', ',
                  )}"`,
                  reverseEdgeName,
                  { path: reverseEdgeConfigPath },
                );
              }

              assertPlainObjectConfig(reverseEdgeConfig, reverseEdgeConfigPath);

              const originalEdgeConfig = reverseEdgeConfig.originalEdge;
              const originalEdgeConfigPath = addPath(
                reverseEdgeConfigPath,
                'originalEdge',
              );

              if (
                typeof originalEdgeConfig !== 'string' ||
                !originalEdgeConfig
              ) {
                throw new UnexpectedConfigError(
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
                throw new UnexpectedConfigError(
                  `a node having an edge heading to the "${this}" node (= a value among "${[
                    ...referrersByNameByNodeName.keys(),
                  ].join(', ')}")`,
                  nodeEdgeConfig,
                  { path: originalEdgeConfigPath },
                );
              } else if (!referrersByName.size) {
                throw new ConfigError(
                  `Expects no more configuration for "${nodeEdgeConfig}"'s edge as there is no more edge heading to the "${this}" node`,
                  { path: originalEdgeConfigPath },
                );
              }

              let originalEdge: Edge;

              if (edgeEdgeConfig) {
                if (!referrersByName.has(edgeEdgeConfig)) {
                  throw new UnexpectedConfigError(
                    `an edge heading to the "${this}" node (= a value among "${[
                      ...referrersByName.keys(),
                    ].join(', ')}")`,
                    edgeEdgeConfig,
                    { path: originalEdgeConfigPath },
                  );
                }

                originalEdge = referrersByName.get(edgeEdgeConfig)!;
              } else {
                originalEdge = [...referrersByName.values()][0];
              }

              referrersByName.delete(originalEdge.name);

              let reverseEdge: ReverseEdge;

              const kindConfig = reverseEdgeConfig.kind;
              const kindConfigPath = addPath(reverseEdgeConfigPath, 'kind');

              if (originalEdge.isUnique()) {
                if (kindConfig != null && kindConfig !== 'Unique') {
                  throw new UnexpectedConfigError(
                    `"Unique" as the "${originalEdge}" edge is unique`,
                    kindConfig,
                    { path: kindConfigPath },
                  );
                }

                reverseEdge = new ReverseEdgeUnique(
                  originalEdge,
                  reverseEdgeName,
                  reverseEdgeConfig as any,
                  reverseEdgeConfigPath,
                );
              } else {
                if (kindConfig != null && kindConfig !== 'Multiple') {
                  throw new UnexpectedConfigError(
                    `"Multiple" as the "${originalEdge}" edge is not unique`,
                    kindConfig,
                    { path: kindConfigPath },
                  );
                }

                reverseEdge = new ReverseEdgeMultiple(
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
        : [],
    );

    const missingConfigs = [...referrersByNameByNodeName.values()].flatMap(
      (referrersByName) => Array.from(referrersByName.values(), String),
    );

    if (missingConfigs.length) {
      throw new ConfigError(
        `Expects a configuration for the following referrer(s): ${missingConfigs.join(
          ', ',
        )}`,
        { path: reverseEdgesConfigPath },
      );
    }

    return reverseEdges;
  }

  public getReverseEdgeByName(
    name: ReverseEdge['name'],
    path?: Path,
  ): ReverseEdge<TRequestContext, TConnector> {
    const reverseEdge = this.reverseEdgesByName.get(name);
    if (!reverseEdge) {
      throw new UnexpectedValueError(
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
  public get reverseEdgeUniquesByName(): ReadonlyMap<
    ReverseEdgeUnique['name'],
    ReverseEdgeUnique<TRequestContext, TConnector>
  > {
    return new Map(
      [...this.reverseEdgesByName].filter(
        (entry): entry is [string, ReverseEdgeUnique] =>
          entry[1] instanceof ReverseEdgeUnique,
      ),
    );
  }

  public getReverseEdgeUniqueByName(
    name: ReverseEdgeUnique['name'],
    path?: Path,
  ): ReverseEdgeUnique<TRequestContext, TConnector> {
    const reverseEdge = this.reverseEdgeUniquesByName.get(name);
    if (!reverseEdge) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s reverse-edge-unique among "${[
          ...this.reverseEdgeUniquesByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return reverseEdge;
  }

  @Memoize()
  public get reverseEdgeMultiplesByName(): ReadonlyMap<
    ReverseEdgeMultiple['name'],
    ReverseEdgeMultiple<TRequestContext, TConnector>
  > {
    return new Map(
      [...this.reverseEdgesByName].filter(
        (entry): entry is [string, ReverseEdgeMultiple] =>
          entry[1] instanceof ReverseEdgeMultiple,
      ),
    );
  }

  public getReverseEdgeMultipleByName(
    name: ReverseEdgeMultiple['name'],
    path?: Path,
  ): ReverseEdgeMultiple<TRequestContext, TConnector> {
    const reverseEdge = this.reverseEdgeMultiplesByName.get(name);
    if (!reverseEdge) {
      throw new UnexpectedValueError(
        `${this.indefinite}'s reverse-edge-multiple among "${[
          ...this.reverseEdgeMultiplesByName.keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return reverseEdge;
  }

  @Memoize()
  public get outputType(): NodeOutputType {
    return new NodeOutputType(this);
  }

  @Memoize()
  public get uniqueFilterInputType(): NodeUniqueFilterInputType {
    return new NodeUniqueFilterInputType(this);
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
  public get creationInputType(): NodeCreationInputType<
    TRequestContext,
    TConnector
  > {
    return new NodeCreationInputType(this);
  }

  @Memoize((edge: Edge) => edge)
  public getCreationWithoutEdgeInputType(
    edge: Edge,
  ): NodeCreationInputType<TRequestContext, TConnector> {
    return new NodeCreationInputType(this, edge);
  }

  @Memoize()
  public get updateInputType(): NodeUpdateInputType<
    TRequestContext,
    TConnector
  > {
    return new NodeUpdateInputType(this);
  }

  @Memoize()
  public get mutationsByKey(): Readonly<
    MutationsByKey<TRequestContext, TConnector>
  > {
    return Object.fromEntries(
      Object.entries(mutationConstructorsByKey).map(([name, constructor]) => [
        name,
        new constructor(this),
      ]),
    ) as any;
  }

  public getMutationByKey<TKey extends MutationKey>(
    key: TKey,
    path?: Path,
  ): MutationsByKey<TRequestContext, TConnector>[TKey] {
    if (!this.mutationsByKey[key]) {
      throw new UnexpectedValueError(
        `a mutation's key among "${Object.keys(this.mutationsByKey).join(
          ', ',
        )}"`,
        key,
        { path },
      );
    }

    return this.mutationsByKey[key];
  }

  @Memoize()
  public get queriesByKey(): Readonly<
    QueriesByKey<TRequestContext, TConnector>
  > {
    return Object.fromEntries(
      Object.entries(queryConstructorsByKey).map(([name, constructor]) => [
        name,
        new constructor(this),
      ]),
    ) as any;
  }

  public getQueryByKey<TKey extends QueryKey>(
    key: TKey,
    path?: Path,
  ): QueriesByKey<TRequestContext, TConnector>[TKey] {
    if (!this.queriesByKey[key]) {
      throw new UnexpectedValueError(
        `a query's key among "${Object.keys(this.queriesByKey).join(', ')}"`,
        key,
        { path },
      );
    }

    return this.queriesByKey[key];
  }

  @Memoize()
  public get subscriptionsByKey(): Readonly<
    NodeSubscriptionsByKey<TRequestContext, TConnector>
  > {
    return Object.fromEntries(
      Object.entries(nodeSubscriptionConstructorsByKey).map(
        ([name, constructor]) => [name, new constructor(this)],
      ),
    ) as any;
  }

  public getSubscriptionByKey<TKey extends NodeSubscriptionKey>(
    key: TKey,
    path?: Path,
  ): NodeSubscriptionsByKey<TRequestContext, TConnector>[TKey] {
    if (!this.subscriptionsByKey[key]) {
      throw new UnexpectedValueError(
        `a subscription's key among "${Object.keys(
          this.subscriptionsByKey,
        ).join(', ')}"`,
        key,
        { path },
      );
    }

    return this.subscriptionsByKey[key];
  }

  @Memoize()
  public get operations(): ReadonlyArray<
    | MutationInterface<TRequestContext, TConnector>
    | OperationInterface<TRequestContext, TConnector>
  > {
    return [
      ...Object.values<MutationInterface>(this.mutationsByKey),
      ...Object.values<OperationInterface>(this.queriesByKey),
      ...Object.values<OperationInterface>(this.subscriptionsByKey),
    ];
  }

  @Memoize()
  public validateDefinition(): void {
    aggregateConfigError<Component, void>(
      this.componentsByName.values(),
      (_, component) => component.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    aggregateConfigError<UniqueConstraint, void>(
      this.uniqueConstraintsByName.values(),
      (_, uniqueConstraint) => uniqueConstraint.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    this.selection;

    if (this.isMutationEnabled(MutationType.UPDATE)) {
      if (
        ![...this.componentsByName.values()].some((component) =>
          component.isMutable(),
        )
      ) {
        throw new ConfigError(
          `Expects at least one mutable component as it is mutable: either disable the "${MutationType.UPDATE}" or enable it on one of its components`,
          { path: this.configPath },
        );
      }
    }

    if (this.isPublic()) {
      if (
        ![...this.componentsByName.values()].some((component) =>
          component.isPublic(),
        )
      ) {
        throw new ConfigError(
          `Expects at least one public component as it is public: either set it private or set one of its components public`,
          { path: this.configPath },
        );
      }

      if (
        ![...this.uniqueConstraintsByName.values()].some((uniqueConstraint) =>
          uniqueConstraint.isPublic(),
        )
      ) {
        throw new ConfigError(
          `Expects at least one public unique constraint (= with all its components being public) as it is public`,
          { path: this.configPath },
        );
      }
    }

    aggregateConfigError<ReverseEdge, void>(
      this.reverseEdgesByName.values(),
      (_, reverseEdge) => reverseEdge.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    this.reverseEdgeUniquesByName;
    this.reverseEdgeMultiplesByName;
  }

  @Memoize()
  public validateTypes(): void {
    aggregateConfigError<Component, void>(
      this.componentsByName.values(),
      (_, component) => component.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    aggregateConfigError<ReverseEdge, void>(
      this.reverseEdgesByName.values(),
      (_, reverseEdge) => reverseEdge.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    this.filterInputType.validate();
    this.orderingInputType.validate();
    this.uniqueFilterInputType.validate();
    this.outputType.validate();
    this.creationInputType.validate();
    this.updateInputType.validate();
  }

  @Memoize()
  public validateOperations(): void {
    aggregateConfigError<OperationInterface, void>(
      this.operations,
      (_, operation) => operation.validate(),
      undefined,
      { path: this.configPath },
    );
  }

  public getAuthorizationByRequestContext(
    requestContext: TRequestContext,
    path: Path,
    mutationType?: MutationType,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    let rawAuthorization: boolean | NodeFilterInputValue;
    try {
      rawAuthorization = this.#authorizationConfig?.(
        requestContext,
        mutationType,
      );
    } catch (error) {
      throw new UnauthorizedError(this, {
        path,
        cause: new ConfigError(
          `Expects a valid authorization for "${mutationType ?? 'query'}"`,
          {
            path: this.#authorizationConfigPath,
            cause: castToError(error),
          },
        ),
      });
    }

    let authorization: NodeFilter<TRequestContext, TConnector> | undefined;
    try {
      authorization = this.filterInputType.parseAndFilter(
        rawAuthorization === true
          ? undefined
          : rawAuthorization === false
          ? null
          : rawAuthorization,
      ).normalized;
    } catch (error) {
      throw new UnauthorizedError(this, {
        path,
        cause: new ConfigError(
          `Expects a valid authorization for "${mutationType ?? 'query'}"`,
          {
            path: this.#authorizationConfigPath,
            cause: castToError(error),
          },
        ),
      });
    }

    if (authorization?.isFalse()) {
      throw new UnauthorizedError(this, { path });
    }

    return authorization;
  }

  public parseValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): NodeValue {
    if (!isPlainObject(maybeValue)) {
      throw new UnexpectedValueError('a plain-object', maybeValue, { path });
    }

    return aggregateError<Component, NodeValue>(
      this.componentsByName.values(),
      (value, component) =>
        Object.assign(value, {
          [component.name]: component.parseValue(
            maybeValue[component.name],
            addPath(path, component.name),
          ),
        }),
      Object.create(null),
      { path },
    );
  }

  public areValuesEqual(a: NodeValue, b: NodeValue): boolean {
    return Array.from(this.componentsByName.values()).every((component) =>
      component.areValuesEqual(
        a[component.name] as any,
        b[component.name] as any,
      ),
    );
  }
}
