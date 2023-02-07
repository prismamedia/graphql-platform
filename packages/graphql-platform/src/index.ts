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
  getCustomOperationsByNameByType,
  type CustomOperationsByNameByTypeConfig,
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
export * from './graphql-field-config.js';
export * from './maybe-aware-config.js';
export * from './node.js';
export * from './seeding.js';

export type RequestContextAssertion<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TContainer>,
  maybeRequestContext: object,
) => asserts maybeRequestContext is TRequestContext;

export type GraphQLPlatformEventDataByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = { 'node-change': NodeChange<TRequestContext> };

export type GraphQLPlatformConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
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
    [nodeName: NodeName]: NodeConfig<TRequestContext, TConnector, TContainer>;
  };

  /**
   * Optional, add some "custom" operations
   */
  customOperations?: CustomOperationsByNameByTypeConfig<
    TRequestContext,
    TConnector,
    TContainer
  >;

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
   * Convenient when the GraphQL-Platform is used with multiple integrations and you want to validate its context
   *
   * By default, the context provided by the integration is provided "as is"
   *
   * @see: https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument
   */
  requestContextAssertion?: RequestContextAssertion<
    TRequestContext,
    TConnector,
    TContainer
  >;

  /**
   * Optional, register some event-listeners, all at once
   */
  on?: EventConfigByName<
    GraphQLPlatformEventDataByName<TRequestContext, TConnector, TContainer>
  >;

  /**
   * Optional, register a node-change-listeners
   */
  onNodeChange?: EventListener<
    GraphQLPlatformEventDataByName<TRequestContext, TConnector, TContainer>,
    'node-change'
  >;

  /**
   * Optional, given the GraphQL-Platform instance, build a service-container which will be accessible further in the hooks, the virtual-fields and the custom-operations
   */
  container?: utils.ThunkOrValue<
    TContainer,
    [gp: GraphQLPlatform<TRequestContext, TConnector, {}>]
  >;
};

export class GraphQLPlatform<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> extends AsyncEventEmitter<
  GraphQLPlatformEventDataByName<TRequestContext, TConnector, TContainer>
> {
  public readonly nodesByName: ReadonlyMap<
    Node['name'],
    Node<TRequestContext, TConnector, TContainer>
  >;
  public readonly nodes: ReadonlyArray<
    Node<TRequestContext, TConnector, TContainer>
  >;
  public readonly nodeSet: ReadonlySet<
    Node<TRequestContext, TConnector, TContainer>
  >;

  public readonly operationsByNameByType: OperationsByNameByType<TRequestContext>;

  public readonly api: API<TRequestContext>;

  readonly #connector?: TConnector;

  public readonly container: TContainer;

  readonly #requestContextAssertion?: (
    maybeRequestContext: object,
  ) => asserts maybeRequestContext is TRequestContext;

  public constructor(
    public readonly config: GraphQLPlatformConfig<
      TRequestContext,
      TConnector,
      TContainer
    >,
    public readonly configPath: utils.Path = utils.addPath(
      undefined,
      'GraphQLPlatformConfig',
    ),
  ) {
    utils.assertPlainObject(config, configPath);

    super(config.on);

    // on-node-change
    {
      const onNodeChange = config.onNodeChange;
      const onNodeChangePath = utils.addPath(configPath, 'onNodeChange');

      if (onNodeChange) {
        utils.assertFunction(onNodeChange, onNodeChangePath);

        this.on('node-change', onNodeChange);
      }
    }

    // nodes
    {
      const nodesConfig = config.nodes;
      const nodesConfigPath = utils.addPath(configPath, 'nodes');

      utils.assertPlainObject(nodesConfig, nodesConfigPath);

      if (!Object.entries(nodesConfig).length) {
        throw new utils.UnexpectedValueError(
          `at least one "node"`,
          nodesConfig,
          { path: nodesConfigPath },
        );
      }

      this.nodesByName = new Map(
        utils.aggregateGraphError<
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
        utils.aggregateGraphError<Node, void>(
          this.nodes,
          (_, node) => node.validateDefinition(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateGraphError<Node, void>(
          this.nodes,
          (_, node) => node.validateTypes(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateGraphError<Node, void>(
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

    // container
    {
      const containerConfig = this.config.container;
      const containerConfigPath = utils.addPath(this.configPath, 'container');

      const container = utils.resolveThunkOrValue(containerConfig, this);
      if (container != null && typeof container !== 'object') {
        throw new utils.UnexpectedValueError('an object', container, {
          path: containerConfigPath,
        });
      }

      this.container = container ?? ({} as TContainer);
    }

    // request-context-assertion
    {
      const requestContextAssertionConfig = config.requestContextAssertion;
      const requestContextAssertionConfigPath = utils.addPath(
        configPath,
        'requestContextAssertion',
      );

      if (requestContextAssertionConfig) {
        utils.assertFunction(
          requestContextAssertionConfig,
          requestContextAssertionConfigPath,
        );

        this.#requestContextAssertion =
          requestContextAssertionConfig.bind(this);
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
  ): OperationInterface<TRequestContext> {
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

      this.#requestContextAssertion?.(maybeRequestContext);
    } catch (error) {
      throw new InvalidRequestContextError({
        cause: error,
        path,
      });
    }
  }

  @Memoize()
  public get connector(): TConnector {
    if (!this.#connector) {
      throw new utils.GraphError(`No connector has been provided`, {
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
        utils.operationTypes
          .map((type): [string, graphql.GraphQLObjectType] | undefined => {
            const fields: graphql.GraphQLFieldConfigMap<any, any> = {
              // Core-operations
              ...Object.fromEntries(
                [...this.operationsByNameByType[type].values()]
                  .filter((operation) => operation.isPublic())
                  .map((operation) => [
                    operation.name,
                    operation.getGraphQLFieldConfig(),
                  ]),
              ),

              // Custom-operations
              ...getCustomOperationsByNameByType(
                this,
                this.config.customOperations,
                type,
              ),
            };

            return Object.keys(fields).length > 0
              ? [type, new graphql.GraphQLObjectType({ name: type, fields })]
              : undefined;
          })
          .filter(
            (maybeEntry): maybeEntry is [string, graphql.GraphQLObjectType] =>
              maybeEntry !== undefined,
          ),
      ),
    });

    graphql.assertValidSchema(schema);

    return schema;
  }
}
