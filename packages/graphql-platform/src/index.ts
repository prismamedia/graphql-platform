import {
  AsyncEventEmitter,
  type EventConfigByName,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { Constructor, Except } from 'type-fest';
import type { ConnectorInterface } from './connector-interface.js';
import {
  getCustomOperationMap,
  type CustomOperationMap,
} from './custom-operations.js';
import {
  createAPI,
  InvalidRequestContextError,
  Node,
  type API,
  type NodeChange,
  type NodeConfig,
  type NodeName,
  type OperationInterface,
  type OperationsByNameByType,
} from './node.js';
import {
  Seeding,
  type NodeFixtureDataByReferenceByNodeName,
} from './seeding.js';

export * from './connector-interface.js';
export * from './custom-operations.js';
export * from './node.js';
export * from './seeding.js';

export type GraphQLPlatformEventDataByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = { 'node-change': NodeChange<TRequestContext, TConnector> };

export type GraphQLPlatformConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = {
  /**
   * Required, provide the nodes' definition
   */
  nodes: {
    /**
     * The nodes' name are expected to be provided in "PascalCase" and to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [nodeName: NodeName]: NodeConfig<TRequestContext, TConnector>;
  };

  /**
   * Optional, add some "custom" operations
   */
  customOperations?: CustomOperationMap<TRequestContext, TConnector>;

  /**
   * Optional, fine-tune the generated GraphQL Schema
   */
  schema?: Except<graphql.GraphQLSchemaConfig, graphql.OperationTypeNode>;

  /**
   * Optional, provide a connector to let the schema be executable
   */
  connector?:
    | TConnector
    | Constructor<TConnector, [GraphQLPlatform]>
    | [
        Constructor<
          TConnector,
          [GraphQLPlatform, TConnector['config'], utils.Path]
        >,
        TConnector['config'],
      ];

  /**
   * Optional, a method which asserts the request-context validity
   *
   * Convenient when the GraphQL Platform is used with multiple integrations and you want to validate its context
   *
   * By default, the context provided by the integration is provided "as is"
   *
   * @see: https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument
   */
  assertRequestContext?(
    this: GraphQLPlatform<TRequestContext, TConnector>,
    maybeRequestContext: object,
  ): asserts maybeRequestContext is TRequestContext;

  /**
   * Optional, register some event-listeners, all at once
   */
  on?: EventConfigByName<
    GraphQLPlatformEventDataByName<TRequestContext, TConnector>
  >;

  /**
   * Optional, register a node-change-listeners
   */
  onNodeChange?: EventListener<
    GraphQLPlatformEventDataByName<TRequestContext, TConnector>,
    'node-change'
  >;
};

export class GraphQLPlatform<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AsyncEventEmitter<
  GraphQLPlatformEventDataByName<TRequestContext, TConnector>
> {
  public readonly nodesByName: ReadonlyMap<
    Node['name'],
    Node<TRequestContext, TConnector>
  >;
  public readonly nodes: ReadonlyArray<Node<TRequestContext, TConnector>>;
  public readonly nodeSet: ReadonlySet<Node<TRequestContext, TConnector>>;

  public readonly operationsByNameByType: OperationsByNameByType<
    TRequestContext,
    TConnector
  >;

  public readonly api: API<TRequestContext, TConnector>;

  readonly #connector?: TConnector;

  readonly #assertRequestContext?: (
    maybeRequestContext: object,
  ) => asserts maybeRequestContext is TRequestContext;

  public constructor(
    public readonly config: GraphQLPlatformConfig<TRequestContext, TConnector>,
    public readonly configPath: utils.Path = utils.addPath(
      undefined,
      'GraphQLPlatformConfig',
    ),
  ) {
    utils.assertPlainObjectConfig(config, configPath);

    super(config.on);

    // on-node-change
    config.onNodeChange && this.on('node-change', config.onNodeChange);

    // nodes
    {
      const nodesConfig = config.nodes;
      const nodesConfigPath = utils.addPath(configPath, 'nodes');

      if (
        !utils.isPlainObject(nodesConfig) ||
        !Object.entries(nodesConfig).length
      ) {
        throw new utils.UnexpectedConfigError(
          `at least one "node"`,
          nodesConfig,
          {
            path: nodesConfigPath,
          },
        );
      }

      this.nodesByName = new Map(
        utils.aggregateConfigError<
          [Node['name'], NodeConfig<any, any>],
          [Node['name'], Node][]
        >(
          Object.entries(nodesConfig),
          (entries, [nodeName, nodeConfig]) => [
            ...entries,
            [
              nodeName,
              new Node(
                this,
                nodeName,
                nodeConfig,
                utils.addPath(nodesConfigPath, nodeName),
              ),
            ],
          ],
          [],
          { path: nodesConfigPath },
        ),
      );

      this.nodes = Array.from(this.nodesByName.values());
      this.nodeSet = new Set(this.nodes);

      /**
       * In order to fail as soon as possible, we validate/build everything right away.
       * It is done step by step in order to have meaningful errors.
       */
      {
        utils.aggregateConfigError<Node, void>(
          this.nodes,
          (_, node) => node.validateDefinition(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateConfigError<Node, void>(
          this.nodes,
          (_, node) => node.validateTypes(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateConfigError<Node, void>(
          this.nodes,
          (_, node) => node.validateOperations(),
          undefined,
          { path: nodesConfigPath },
        );
      }
    }

    // operations
    {
      this.operationsByNameByType = Object.fromEntries(
        utils.operationTypes.map((type): any => [
          type,
          new Map(
            this.nodes.flatMap((node) =>
              node.operations
                .filter(
                  (operation) =>
                    operation.operationType === type && operation.isEnabled(),
                )
                .map((operation) => [operation.name, operation]),
            ),
          ),
        ]),
      ) as OperationsByNameByType;
    }

    // API
    {
      this.api = createAPI(this);
    }

    // connector
    {
      const connectorConfig = this.config.connector;
      const connectorConfigPath = utils.addPath(this.configPath, 'connector');

      this.#connector = connectorConfig
        ? utils.isConstructor<TConnector, [GraphQLPlatform]>(connectorConfig)
          ? new connectorConfig(this)
          : Array.isArray(connectorConfig)
          ? connectorConfig.length
            ? new connectorConfig[0](
                this,
                connectorConfig[1],
                utils.addPath(connectorConfigPath, 1),
              )
            : undefined
          : connectorConfig
        : undefined;
    }

    // assert-request-context
    {
      const assertRequestContextConfig = config.assertRequestContext;
      const assertRequestContextConfigPath = utils.addPath(
        configPath,
        'assertRequestContext',
      );

      if (assertRequestContextConfig != null) {
        if (typeof assertRequestContextConfig !== 'function') {
          throw new utils.UnexpectedConfigError(
            `a function`,
            assertRequestContextConfig,
            { path: assertRequestContextConfigPath },
          );
        }

        this.#assertRequestContext = assertRequestContextConfig.bind(this);
      }
    }
  }

  public getNodeByName(
    name: Node['name'],
    path?: utils.Path,
  ): Node<TRequestContext, TConnector> {
    const node = this.nodesByName.get(name);
    if (!node) {
      throw new utils.UnexpectedValueError(
        `a node's name among "${Array.from(this.nodesByName.keys()).join(
          ', ',
        )}"`,
        name,
        { path },
      );
    }

    return node;
  }

  public ensureNodeOrName(
    nodeOrName: Node | Node['name'],
    path?: utils.Path,
  ): Node<TRequestContext, TConnector> {
    if (typeof nodeOrName === 'string') {
      return this.getNodeByName(nodeOrName, path);
    } else if (this.nodeSet.has(nodeOrName)) {
      return nodeOrName;
    }

    throw new utils.UnexpectedValueError(
      `a node among "${[...this.nodesByName.keys()].join(', ')}"`,
      String(nodeOrName),
      { path },
    );
  }

  public getOperationByTypeAndName(
    type: graphql.OperationTypeNode,
    name: string,
    path?: utils.Path,
  ): OperationInterface<TRequestContext, TConnector> {
    if (!utils.operationTypes.includes(type)) {
      throw new utils.UnexpectedValueError(
        `an operation's type among "${utils.operationTypes.join(', ')}"`,
        type,
        { path },
      );
    }

    const operation = this.operationsByNameByType[type].get(name);
    if (!operation) {
      throw new utils.UnexpectedValueError(
        `an operation's name among "${[
          ...this.operationsByNameByType[type].keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return operation;
  }

  public assertRequestContext(
    maybeRequestContext: unknown,
    path?: utils.Path,
  ): asserts maybeRequestContext is TRequestContext {
    try {
      if (
        typeof maybeRequestContext !== 'object' ||
        maybeRequestContext === null
      ) {
        throw new utils.UnexpectedValueError('an object', maybeRequestContext, {
          path,
        });
      }

      this.#assertRequestContext?.(maybeRequestContext);
    } catch (error) {
      throw new InvalidRequestContextError({
        cause: utils.castToError(error),
        path,
      });
    }
  }

  @Memoize()
  public get connector(): TConnector {
    if (!this.#connector) {
      throw new utils.ConfigError(`No connector has been provided`, {
        path: utils.addPath(this.configPath, 'connector'),
      });
    }

    return this.#connector;
  }

  public async seed(
    fixtures: NodeFixtureDataByReferenceByNodeName,
    context: TRequestContext,
  ): Promise<void> {
    const seeding = new Seeding(this, fixtures);
    await seeding.load(context);
  }

  @Memoize()
  public get schema(): graphql.GraphQLSchema {
    const schema = new graphql.GraphQLSchema({
      ...this.config.schema,

      ...Object.fromEntries(
        utils.operationTypes.map((type) => {
          const fields: graphql.GraphQLFieldConfigMap<
            undefined,
            TRequestContext
          > = {
            // Native operations
            ...Object.fromEntries(
              [...this.operationsByNameByType[type].values()]
                .filter((operation) => operation.isPublic())
                .map((operation) => [
                  operation.name,
                  operation.getGraphQLFieldConfig(),
                ]),
            ),

            // Custom operations
            ...getCustomOperationMap(this, this.config.customOperations, type),
          };

          return [
            type,
            Object.keys(fields).length > 0
              ? new graphql.GraphQLObjectType({ name: type, fields })
              : undefined,
          ];
        }),
      ),
    });

    graphql.assertValidSchema(schema);

    return schema;
  }
}
