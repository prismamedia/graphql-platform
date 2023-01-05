import type { EventListener } from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { JsonObject } from 'type-fest';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from './connector-interface.js';
import type {
  GraphQLPlatform,
  GraphQLPlatformEventDataByName,
} from './index.js';
import { NodeCursor, type NodeCursorOptions } from './node/cursor.js';
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
  OperationContext,
  queryConstructorsByKey,
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
  NodeSelection,
  type NodeFilter,
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
export * from './node/cursor.js';
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
  UniqueConstraintValue &
  Record<Component['name'], ComponentValue>;

export type NodeAuthorizationConfig<TRequestContext extends object> = (
  requestContext: TRequestContext,
  mutationType?: utils.MutationType,
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
    [componentName: utils.Name]: ComponentConfig<TRequestContext, TConnector>;
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
    [reverseEdge: utils.Name]: ReverseEdgeConfig<TRequestContext, TConnector>;
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
   * Optional, fine-tune the access to these nodes, given the request-context and the access-type among "query" (= !mutationType) / "creation" / "update" / "deletion":
   * - deny all access by returning either "false" or "null"
   * - grant full access by returning either "true" or "undefined"
   * - grant access to a subset by returning a filter (= the "where" argument)
   */
  authorization?: NodeAuthorizationConfig<TRequestContext>;

  /**
   * Optional, register some change-listeners
   */
  onChange?: EventListener<
    GraphQLPlatformEventDataByName<TRequestContext, TConnector>,
    'node-change'
  >;
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
  public readonly components: ReadonlyArray<
    Component<TRequestContext, TConnector>
  >;
  public readonly componentSet: ReadonlySet<
    Component<TRequestContext, TConnector>
  >;

  public readonly leavesByName: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector>
  >;
  public readonly leaves: ReadonlyArray<Leaf<TRequestContext, TConnector>>;
  public readonly leaveSet: ReadonlySet<Leaf<TRequestContext, TConnector>>;

  public readonly edgesByName: ReadonlyMap<
    Edge['name'],
    Edge<TRequestContext, TConnector>
  >;
  public readonly edges: ReadonlyArray<Edge<TRequestContext, TConnector>>;
  public readonly edgeSet: ReadonlySet<Edge<TRequestContext, TConnector>>;

  public readonly uniqueConstraintsByName: ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint<TRequestContext, TConnector>
  >;
  public readonly uniqueConstraints: ReadonlyArray<
    UniqueConstraint<TRequestContext, TConnector>
  >;
  public readonly uniqueConstraintSet: ReadonlySet<
    UniqueConstraint<TRequestContext, TConnector>
  >;

  public readonly identifier: UniqueConstraint<TRequestContext, TConnector>;

  readonly #authorizationConfig?: NodeAuthorizationConfig<TRequestContext>;

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,
    public readonly name: NodeName,
    public readonly config: NodeConfig<TRequestContext, TConnector>,
    public readonly configPath: utils.Path,
  ) {
    assertNodeName(name, configPath);
    utils.assertPlainObjectConfig(config, configPath);

    // on-change
    {
      config.onChange &&
        gp.on('node-change', async (change) => {
          if (change.node === this) {
            await config.onChange!(change);
          }
        });
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

      if (
        !utils.isPlainObject(componentsConfig) ||
        !Object.entries(componentsConfig).length
      ) {
        throw new utils.UnexpectedValueError(
          `at least one "component"`,
          componentsConfig,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        utils.aggregateGraphError<
          [Component['name'], ComponentConfig<any, any>],
          [Component['name'], Component][]
        >(
          Object.entries(componentsConfig),
          (entries, [componentName, componentConfig]) => {
            const componentConfigPath = utils.addPath(
              componentsConfigPath,
              componentName,
            );

            utils.assertPlainObjectConfig(componentConfig, componentConfigPath);

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

      this.components = Array.from(this.componentsByName.values());
      this.componentSet = new Set(this.components);

      // leaves
      {
        this.leavesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Leaf] => entry[1] instanceof Leaf,
          ),
        );

        this.leaves = Array.from(this.leavesByName.values());
        this.leaveSet = new Set(this.leaves);
      }

      // edges
      {
        this.edgesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Edge] => entry[1] instanceof Edge,
          ),
        );

        this.edges = Array.from(this.edgesByName.values());
        this.edgeSet = new Set(this.edges);
      }
    }

    // uniques
    {
      const uniquesConfig = config.uniques;
      const uniquesConfigPath = utils.addPath(configPath, 'uniques');

      if (!Array.isArray(uniquesConfig) || !uniquesConfig.length) {
        throw new utils.UnexpectedValueError(
          `at least one "unique-constraint"`,
          uniquesConfig,
          { path: uniquesConfigPath },
        );
      }

      this.uniqueConstraintsByName = new Map(
        utils.aggregateGraphError<
          UniqueConstraintConfig<any, any>,
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

      this.uniqueConstraints = Array.from(
        this.uniqueConstraintsByName.values(),
      );
      this.uniqueConstraintSet = new Set(this.uniqueConstraints);

      // identifier (= the first unique constraint)
      {
        const identifierConfigPath = utils.addPath(uniquesConfigPath, 0);

        this.identifier = this.uniqueConstraints[0];

        if (this.identifier.isNullable()) {
          throw new utils.GraphError(
            `Expects its identifier (= the first unique constraint, composed of the component${
              this.identifier.isComposite() ? 's' : ''
            } "${[...this.identifier.componentsByName.keys()].join(
              ', ',
            )}") to be non-nullable (= at least one of its components being non-nullable)`,
            { path: identifierConfigPath },
          );
        }

        if (this.identifier.isMutable()) {
          throw new utils.GraphError(
            `Expects its identifier (= the first unique constraint, composed of the component${
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

      if (authorizationConfig != null) {
        if (typeof authorizationConfig !== 'function') {
          throw new utils.UnexpectedValueError(
            `a function`,
            authorizationConfig,
            { path: authorizationConfigPath },
          );
        }

        this.#authorizationConfig = (...args) => {
          try {
            return authorizationConfig(...args);
          } catch (error) {
            throw new utils.GraphError(
              `The request-authorizer threw an error`,
              {
                path: authorizationConfigPath,
                cause: utils.castToError(error),
              },
            );
          }
        };
      }
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
    config?: MutationConfig<TRequestContext, TConnector>[TType];
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
  public isMutationEnabled(mutationType: utils.MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    return utils.getOptionalFlag(
      config?.enabled,
      true,
      utils.addPath(configPath, 'enabled'),
    );
  }

  @Memoize((mutationType: utils.MutationType) => mutationType)
  public isMutationPublic(mutationType: utils.MutationType): boolean {
    const { config, configPath } = this.getMutationConfig(mutationType);

    const publicConfig = config?.public;
    const publicConfigPath = utils.addPath(configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      publicConfig,
      this.isPublic() && this.isMutationEnabled(mutationType),
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

      if (!this.isMutationEnabled(mutationType)) {
        throw new utils.UnexpectedValueError(
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
    path?: utils.Path,
  ): Component<TRequestContext, TConnector> {
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

  public ensureComponentOrName(
    componentOrName: Component | Component['name'],
    path?: utils.Path,
  ): Component<TRequestContext, TConnector> {
    if (typeof componentOrName === 'string') {
      return this.getComponentByName(componentOrName, path);
    } else if (this.componentSet.has(componentOrName)) {
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
  ): Leaf<TRequestContext, TConnector> {
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

  public ensureLeafOrName(
    leafOrName: Leaf | Leaf['name'],
    path?: utils.Path,
  ): Leaf<TRequestContext, TConnector> {
    if (typeof leafOrName === 'string') {
      return this.getLeafByName(leafOrName, path);
    } else if (this.leaveSet.has(leafOrName)) {
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
  ): Edge<TRequestContext, TConnector> {
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

  public ensureEdgeOrName(
    edgeOrName: Edge | Edge['name'],
    path?: utils.Path,
  ): Edge<TRequestContext, TConnector> {
    if (typeof edgeOrName === 'string') {
      return this.getEdgeByName(edgeOrName, path);
    } else if (this.edgeSet.has(edgeOrName)) {
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
  ): UniqueConstraint<TRequestContext, TConnector> {
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

  public ensureUniqueConstraintOrName(
    uniqueConstraintOrName: UniqueConstraint | UniqueConstraint['name'],
    path?: utils.Path,
  ): UniqueConstraint<TRequestContext, TConnector> {
    if (typeof uniqueConstraintOrName === 'string') {
      return this.getUniqueConstraintByName(uniqueConstraintOrName, path);
    } else if (this.uniqueConstraintSet.has(uniqueConstraintOrName)) {
      return uniqueConstraintOrName;
    }

    throw new utils.UnexpectedValueError(
      `${this.indefinite}'s unique-constraint among "${[
        ...this.uniqueConstraintsByName.keys(),
      ].join(', ')}"`,
      String(uniqueConstraintOrName),
      { path },
    );
  }

  @Memoize()
  public get selection(): NodeSelection<NodeValue> {
    return new NodeSelection(
      this,
      mergeSelectionExpressions(
        this.components.map(({ selection }) => selection),
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
      this.gp.nodes
        .map((node): [Node['name'], Map<Edge['name'], Edge>] => [
          node.name,
          new Map(
            Array.from(node.edgesByName).filter(
              ([, edge]) => edge.head === this,
            ),
          ),
        ])
        .filter(([, referrersByName]) => referrersByName.size),
    );

    const reverseEdgesConfig = this.config.reverseEdges;
    const reverseEdgesConfigPath = utils.addPath(
      this.configPath,
      'reverseEdges',
    );

    // No reverse-edge
    if (!referrersByNameByNodeName.size) {
      if (
        reverseEdgesConfig != null &&
        (!utils.isPlainObject(reverseEdgesConfig) ||
          Object.entries(reverseEdgesConfig).length)
      ) {
        throw new utils.UnexpectedValueError(
          `no configuration as there is no node having an edge heading to the "${this}" node`,
          reverseEdgesConfig,
          { path: reverseEdgesConfigPath },
        );
      }

      return new Map();
    }

    utils.assertPlainObjectConfig(reverseEdgesConfig, reverseEdgesConfigPath);

    const reverseEdges = new Map(
      reverseEdgesConfig
        ? utils.aggregateGraphError<
            [ReverseEdge['name'], ReverseEdgeConfig<any, any>],
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

              utils.assertPlainObjectConfig(
                reverseEdgeConfig,
                reverseEdgeConfigPath,
              );

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
                originalEdge = [...referrersByName.values()][0];
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

                reverseEdge = new ReverseEdgeUnique(
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
  public get reverseEdges(): ReadonlyArray<
    ReverseEdge<TRequestContext, TConnector>
  > {
    return Array.from(this.reverseEdgesByName.values());
  }

  public getReverseEdgeByName(
    name: ReverseEdge['name'],
    path?: utils.Path,
  ): ReverseEdge<TRequestContext, TConnector> {
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
    path?: utils.Path,
  ): ReverseEdgeUnique<TRequestContext, TConnector> {
    const reverseEdge = this.reverseEdgeUniquesByName.get(name);
    if (!reverseEdge) {
      throw new utils.UnexpectedValueError(
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
    path?: utils.Path,
  ): ReverseEdgeMultiple<TRequestContext, TConnector> {
    const reverseEdge = this.reverseEdgeMultiplesByName.get(name);
    if (!reverseEdge) {
      throw new utils.UnexpectedValueError(
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
  public get creationInputType(): NodeCreationInputType {
    return new NodeCreationInputType(this);
  }

  @Memoize((edge: Edge) => edge)
  public getCreationWithoutEdgeInputType(edge: Edge): NodeCreationInputType {
    return new NodeCreationInputType(this, edge);
  }

  @Memoize()
  public get updateInputType(): NodeUpdateInputType {
    assert(
      this.isMutationEnabled(utils.MutationType.UPDATE),
      `The "${this}" node is immutable`,
    );

    return new NodeUpdateInputType(this);
  }

  @Memoize()
  public get mutationsByKey(): Readonly<
    MutationsByKey<TRequestContext, TConnector>
  > {
    return Object.fromEntries(
      Object.entries(mutationConstructorsByKey).reduce<
        [OperationInterface['name'], OperationInterface][]
      >((entries, [name, constructor]) => {
        const mutation = new constructor(this);

        return mutation.isEnabled() ? [...entries, [name, mutation]] : entries;
      }, []),
    ) as any;
  }

  public getMutationByKey<TKey extends MutationKey>(
    key: TKey,
    path?: utils.Path,
  ): MutationsByKey<TRequestContext, TConnector>[TKey] {
    if (!this.mutationsByKey[key]) {
      throw new utils.UnexpectedValueError(
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
      Object.entries(queryConstructorsByKey).reduce<
        [OperationInterface['name'], OperationInterface][]
      >((entries, [name, constructor]) => {
        const query = new constructor(this);

        return query.isEnabled() ? [...entries, [name, query]] : entries;
      }, []),
    ) as any;
  }

  public getQueryByKey<TKey extends QueryKey>(
    key: TKey,
    path?: utils.Path,
  ): QueriesByKey<TRequestContext, TConnector>[TKey] {
    if (!this.queriesByKey[key]) {
      throw new utils.UnexpectedValueError(
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
      Object.entries(nodeSubscriptionConstructorsByKey).reduce<
        [OperationInterface['name'], OperationInterface][]
      >((entries, [name, constructor]) => {
        const subscription = new constructor(this);

        return subscription.isEnabled()
          ? [...entries, [name, subscription]]
          : entries;
      }, []),
    ) as any;
  }

  public getSubscriptionByKey<TKey extends NodeSubscriptionKey>(
    key: TKey,
    path?: utils.Path,
  ): NodeSubscriptionsByKey<TRequestContext, TConnector>[TKey] {
    if (!this.subscriptionsByKey[key]) {
      throw new utils.UnexpectedValueError(
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
    utils.aggregateGraphError<Component, void>(
      this.components,
      (_, component) => component.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    utils.aggregateGraphError<UniqueConstraint, void>(
      this.uniqueConstraints,
      (_, uniqueConstraint) => uniqueConstraint.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    this.selection;

    if (this.isMutationEnabled(utils.MutationType.UPDATE)) {
      if (!this.components.some((component) => component.isMutable())) {
        throw new utils.GraphError(
          `Expects at least one mutable component as it is mutable`,
          { path: this.configPath },
        );
      }
    }

    if (this.isPublic()) {
      if (!this.components.some((component) => component.isPublic())) {
        throw new utils.GraphError(
          `Expects at least one public component as it is public`,
          { path: this.configPath },
        );
      }

      if (
        !this.uniqueConstraints.some((uniqueConstraint) =>
          uniqueConstraint.isPublic(),
        )
      ) {
        throw new utils.GraphError(
          `Expects at least one public unique constraint (= with all its components being public) as it is public`,
          { path: this.configPath },
        );
      }

      if (this.isMutationPublic(utils.MutationType.UPDATE)) {
        if (
          !this.components.some(
            (component) =>
              component.isMutable() && component.updateInput.isPublic(),
          )
        ) {
          throw new utils.GraphError(
            `Expects at least one publicly mutable component as it is publicly mutable`,
            { path: this.configPath },
          );
        }
      }
    }

    utils.aggregateGraphError<ReverseEdge, void>(
      this.reverseEdges,
      (_, reverseEdge) => reverseEdge.validateDefinition(),
      undefined,
      { path: this.configPath },
    );
    this.reverseEdges;

    this.reverseEdgeUniquesByName;
    this.reverseEdgeMultiplesByName;
  }

  @Memoize()
  public validateTypes(): void {
    utils.aggregateGraphError<Component, void>(
      this.components,
      (_, component) => component.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    utils.aggregateGraphError<ReverseEdge, void>(
      this.reverseEdges,
      (_, reverseEdge) => reverseEdge.validateTypes(),
      undefined,
      { path: this.configPath },
    );

    this.filterInputType.validate();
    this.orderingInputType.validate();
    this.uniqueFilterInputType.validate();
    this.creationInputType.validate();
    this.isMutationEnabled(utils.MutationType.UPDATE) &&
      this.updateInputType.validate();

    this.outputType.validate();
  }

  @Memoize()
  public validateOperations(): void {
    utils.aggregateGraphError<OperationInterface, void>(
      this.operations,
      (_, operation) => operation.validate(),
      undefined,
      { path: this.configPath },
    );
  }

  public getAuthorization(
    context: OperationContext<TRequestContext, TConnector>,
    mutationType?: utils.MutationType,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    const authorization = this.#authorizationConfig?.(
      context.requestContext,
      mutationType,
    );

    return this.filterInputType.parseAndFilter(
      authorization === true
        ? undefined
        : authorization === false
        ? null
        : authorization,
    ).normalized;
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.name),
  ): NodeValue {
    if (!utils.isPlainObject(maybeValue)) {
      throw new utils.UnexpectedValueError('a plain-object', maybeValue, {
        path,
      });
    }

    return utils.aggregateGraphError<Component, NodeValue>(
      this.components,
      (output, component) =>
        Object.assign(output, {
          [component.name]: component.parseValue(
            maybeValue[component.name],
            utils.addPath(path, component.name),
          ),
        }),
      Object.create(null),
      { path },
    );
  }

  public areValuesEqual(a: NodeValue, b: NodeValue): boolean {
    return this.components.every((component) =>
      component.areValuesEqual(
        a[component.name] as any,
        b[component.name] as any,
      ),
    );
  }

  public serialize(value: NodeValue): JsonObject {
    return this.components.reduce<JsonObject>(
      (output, component) =>
        Object.assign(output, {
          [component.name]: component.serialize(value[component.name] as any),
        }),
      Object.create(null),
    );
  }

  @Memoize()
  public isScrollable(): boolean {
    return this.uniqueConstraints.some((uniqueConstraint) =>
      uniqueConstraint.isSortable(),
    );
  }

  public scroll<TValue extends NodeSelectedValue>(
    context: TRequestContext,
    options?: NodeCursorOptions<TValue>,
  ): NodeCursor<TValue, TRequestContext> {
    return new NodeCursor(this, context, options);
  }
}
