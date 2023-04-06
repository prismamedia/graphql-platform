import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { JsonObject, Promisable } from 'type-fest';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from './connector-interface.js';
import type { GraphQLPlatform, OnEdgeHeadDeletion } from './index.js';
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
  type ReverseEdge,
  type ReverseEdgeConfig,
  type UniqueConstraintConfig,
  type UniqueConstraintValue,
} from './node/definition.js';
import { assertNodeName, type NodeName } from './node/name.js';
import {
  OperationContext,
  mutationConstructorsByKey,
  queryConstructorsByKey,
  subscriptionConstructorsByKey,
  type MutationConfig,
  type MutationInterface,
  type MutationKey,
  type MutationsByKey,
  type OperationInterface,
  type QueriesByKey,
  type QueryKey,
  type SubscriptionKey,
  type SubscriptionsByKey,
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
   * Optional, register some change-aggregation-listeners
   */
  onChangeAggregation?: (
    this: Node<TRequestContext, TConnector, TContainer>,
    changes: ReadonlyArray<NodeChange<TRequestContext, TConnector, TContainer>>,
  ) => Promisable<void>;

  /**
   * Optional, register some change-listeners
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

    // on-change-aggregation
    {
      const onChangeAggregation = config.onChangeAggregation;
      const onChangeAggregationPath = utils.addPath(
        configPath,
        'onChangeAggregation',
      );

      if (onChangeAggregation) {
        utils.assertFunction(onChangeAggregation, onChangeAggregationPath);

        gp.on('node-change-aggregation', async (aggregation) => {
          const changes = aggregation.changesByNode.get(this);
          if (changes?.length) {
            await onChangeAggregation.call(this, changes);
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

        gp.on('node-change', async (change) => {
          if (change.node === this) {
            await onChange.call(this, change);
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
  public get mutationsByKey(): Readonly<MutationsByKey<TRequestContext>> {
    return Object.entries(mutationConstructorsByKey).reduce(
      (mutationsByKey, [name, constructor]) => {
        const mutation = new constructor(this);
        if (mutation.isEnabled()) {
          mutationsByKey[name] = mutation;
        }

        return mutationsByKey;
      },
      Object.create(null),
    );
  }

  public getMutationByKey<TKey extends MutationKey>(
    key: TKey,
    path?: utils.Path,
  ): MutationsByKey<TRequestContext>[TKey] {
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
  public get queriesByKey(): Readonly<QueriesByKey<TRequestContext>> {
    return Object.entries(queryConstructorsByKey).reduce(
      (queriesByKey, [name, constructor]) => {
        const query = new constructor(this);
        if (query.isEnabled()) {
          queriesByKey[name] = query;
        }

        return queriesByKey;
      },
      Object.create(null),
    );
  }

  public getQueryByKey<TKey extends QueryKey>(
    key: TKey,
    path?: utils.Path,
  ): QueriesByKey<TRequestContext>[TKey] {
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
    SubscriptionsByKey<TRequestContext>
  > {
    return Object.entries(subscriptionConstructorsByKey).reduce(
      (subscriptionsByKey, [name, constructor]) => {
        const subscription = new constructor(this);
        if (subscription.isEnabled()) {
          subscriptionsByKey[name] = subscription;
        }

        return subscriptionsByKey;
      },
      Object.create(null),
    );
  }

  public getSubscriptionByKey<TKey extends SubscriptionKey>(
    key: TKey,
    path?: utils.Path,
  ): SubscriptionsByKey<TRequestContext>[TKey] {
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
    MutationInterface<TRequestContext> | OperationInterface<TRequestContext>
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
      this.componentsByName.values(),
      (_, component) => component.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    utils.aggregateGraphError<UniqueConstraint, void>(
      this.uniqueConstraintsByName.values(),
      (_, uniqueConstraint) => uniqueConstraint.validateDefinition(),
      undefined,
      { path: this.configPath },
    );

    this.selection;

    if (this.isMutationEnabled(utils.MutationType.UPDATE)) {
      if (
        !Array.from(this.componentsByName.values()).some((component) =>
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
        !Array.from(this.componentsByName.values()).some((component) =>
          component.isPublic(),
        )
      ) {
        throw new utils.GraphError(
          `Expects at least one public component as it is public`,
          { path: this.configPath },
        );
      }

      if (
        !Array.from(this.uniqueConstraintsByName.values()).some(
          (uniqueConstraint) => uniqueConstraint.isPublic(),
        )
      ) {
        throw new utils.GraphError(
          `Expects at least one public unique-constraint (= with all its components being public) as it is public`,
          { path: this.configPath },
        );
      }

      if (this.isMutationPublic(utils.MutationType.UPDATE)) {
        if (
          !Array.from(this.componentsByName.values()).some(
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
      this.reverseEdgesByName.values(),
      (_, reverseEdge) => reverseEdge.validateDefinition(),
      undefined,
      { path: this.configPath },
    );
  }

  @Memoize()
  public validateTypes(): void {
    utils.aggregateGraphError<Component, void>(
      this.componentsByName.values(),
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
    context: OperationContext,
    mutationType?: utils.MutationType,
  ): NodeFilter | undefined {
    let authorization: NodeFilterInputValue | boolean | undefined;

    try {
      authorization = this.config.authorization?.call(
        this.gp,
        context.requestContext,
        mutationType,
      );
    } catch (error) {
      throw new utils.GraphError(`The request-authorizer threw an error`, {
        path: utils.addPath(this.configPath, 'authorization'),
        cause: error,
      });
    }

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
    return Array.from(this.uniqueConstraintsByName.values()).some(
      (uniqueConstraint) => uniqueConstraint.isScrollable(),
    );
  }

  public scroll<TValue extends NodeSelectedValue>(
    context: TRequestContext,
    options?: NodeCursorOptions<TValue>,
  ): NodeCursor<TValue, TRequestContext> {
    return new NodeCursor(this, context, options);
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
}
