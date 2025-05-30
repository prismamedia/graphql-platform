import * as opentelemetry from '@opentelemetry/api';
import {
  AsyncEventEmitter,
  type EventConfigByName,
} from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { Except, Promisable } from 'type-fest';
import type { BrokerInterface } from './broker-interface.js';
import { InMemoryBroker } from './broker/in-memory.js';
import type { ConnectorInterface } from './connector-interface.js';
import {
  getCustomOperationsByNameByType,
  type CustomOperationsByNameByTypeConfig,
} from './custom-operations.js';
import {
  ChangesNotificationError,
  ConnectorWorkflowError,
  ConnectorWorkflowKind,
  InvalidRequestContextError,
  MutationContext,
  Node,
  OperationContext,
  createAPI,
  createContextBoundAPI,
  type API,
  type ContextBoundAPI,
  type MutationContextChanges,
  type MutationContextChangesConfig,
  type NodeConfig,
  type NodeName,
  type Operation,
  type OperationByType,
  type OperationType,
  type SubscriptionConfig,
} from './node.js';
import {
  Seeding,
  type NodeFixtureDataByReferenceByNodeName,
} from './seeding.js';

export * from './broker-interface.js';
export * from './broker/in-memory.js';
export * from './connector-interface.js';
export * from './custom-operations.js';
export * from './node.js';
export * from './seeding.js';

type OperationsByNameByType<TRequestContext extends object = any> = {
  [TType in OperationType]: Map<
    Operation['name'],
    OperationByType<TRequestContext>[TType]
  >;
};

export type RequestContextAssertion<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>,
  maybeRequestContext: object,
) => asserts maybeRequestContext is TRequestContext;

export type EventDataByName<TRequestContext extends object = any> = {
  'node-changes': MutationContextChanges<TRequestContext>;
};

export type ConnectorConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = utils.Thunkable<
  TConnector,
  [gp: GraphQLPlatform<TRequestContext>, configPath: utils.Path]
>;

export type BrokerConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
> = utils.Thunkable<
  TBroker,
  [gp: GraphQLPlatform<TRequestContext, TConnector>, configPath: utils.Path]
>;

export type ContainerConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  TContainer,
  [
    gp: GraphQLPlatform<TRequestContext, TConnector, TBroker>,
    configPath: utils.Path,
  ]
>;

export interface GraphQLPlatformConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> {
  /**
   * Optional, fine-tune the "subscription"
   */
  subscription?: SubscriptionConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  /**
   * Required, provide the nodes' definition
   */
  nodes: {
    /**
     * The nodes' name are expected to be provided in "PascalCase" and to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [nodeName: NodeName]: NodeConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >;
  };

  /**
   * Optional, add some "custom" operations
   */
  customOperations?: CustomOperationsByNameByTypeConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  /**
   * Optional, fine-tune the generated GraphQL Schema
   */
  schema?: Except<graphql.GraphQLSchemaConfig, graphql.OperationTypeNode>;

  /**
   * Optional, provide a connector to let the schema be executable
   */
  connector?: ConnectorConfig<TRequestContext, TConnector>;

  /**
   * Optional, provide a broker to handle the subscriptions
   */
  broker?: BrokerConfig<TRequestContext, TConnector, TBroker>;

  /**
   * Optional, given the GraphQL-Platform instance, build a service-container which will be accessible further in the hooks, the virtual-fields and the custom-operations' resolver
   */
  container?: ContainerConfig<TRequestContext, TConnector, TBroker, TContainer>;

  /**
   * Optional, a method which asserts the request-context validity
   *
   * Convenient when the GraphQL-Platform is used with multiple integrations and you want to validate its context
   *
   * By default, the context provided by the integration is provided "as is"
   *
   * @see https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument
   */
  requestContextAssertion?: RequestContextAssertion<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  /**
   * Optional, limit the maximum number of nodes' changes made by a mutation
   *
   * @default undefined (= Infinity)
   */
  maxNodeChanges?: utils.Thunkable<
    MutationContextChangesConfig | MutationContextChangesConfig['maxSize'],
    [TRequestContext]
  >;

  /**
   * Optional, register some event-listeners, all at once
   */
  on?: utils.Thunkable<
    EventConfigByName<EventDataByName<TRequestContext>>,
    [
      gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>,
      configPath: utils.Path,
    ]
  >;
}

export class GraphQLPlatform<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends AsyncEventEmitter<EventDataByName<TRequestContext>> {
  public readonly subscriptionConfig: {
    readonly enabled: boolean;
    readonly public: boolean;
  };

  public readonly nodesByName: ReadonlyMap<
    Node['name'],
    Node<TRequestContext, TConnector, TBroker, TContainer>
  >;

  public readonly nodeSet: ReadonlySet<
    Node<TRequestContext, TConnector, TBroker, TContainer>
  >;

  public readonly container: TContainer & {
    servicesByNode?: ReadonlyMap<Node, ReadonlyMap<utils.Name, any>>;
  };

  readonly #requestContextAssertion?: (
    maybeRequestContext: object,
  ) => asserts maybeRequestContext is TRequestContext;

  public readonly maxNodeChanges?: utils.Thunkable<
    MutationContextChangesConfig | MutationContextChangesConfig['maxSize'],
    [TRequestContext]
  >;

  readonly #connector?: TConnector;

  public readonly broker: TBroker;

  public constructor(
    public readonly config: GraphQLPlatformConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,
    public readonly configPath: utils.Path = utils.addPath(
      undefined,
      'GraphQLPlatformConfig',
    ),
  ) {
    utils.assertPlainObject(config, configPath);

    super();

    // subscription-config
    {
      const subscriptionConfig = config.subscription;
      const subscriptionConfigPath = utils.addPath(configPath, 'subscription');

      utils.assertNillablePlainObject(
        subscriptionConfig,
        subscriptionConfigPath,
      );

      this.subscriptionConfig = {
        enabled: utils.getOptionalFlag(
          subscriptionConfig?.enabled,
          true,
          utils.addPath(subscriptionConfigPath, 'enabled'),
        ),
        public: utils.getOptionalFlag(
          subscriptionConfig?.public,
          false,
          utils.addPath(subscriptionConfigPath, 'public'),
        ),
      };
    }

    // nodes
    {
      const nodesConfig = config.nodes;
      const nodesConfigPath = utils.addPath(configPath, 'nodes');

      utils.assertPlainObject(nodesConfig, nodesConfigPath);

      if (!Object.entries(nodesConfig).length) {
        throw new utils.UnexpectedValueError(`at least one node`, nodesConfig, {
          path: nodesConfigPath,
        });
      }

      this.nodesByName = utils.aggregateGraphError<
        [Node['name'], NodeConfig],
        Map<Node['name'], Node>
      >(
        Object.entries(nodesConfig),
        (nodesByName, [nodeName, nodeConfig]) => {
          const node = new Node(
            this,
            nodeName,
            nodeConfig,
            utils.addPath(nodesConfigPath, nodeName),
          );

          [node, ...node.associatedNodes].forEach((node) =>
            nodesByName.set(node.name, node),
          );

          return nodesByName;
        },
        new Map<Node['name'], Node>(),
        { path: nodesConfigPath },
      );

      this.nodeSet = new Set(this.nodesByName.values());

      this.nodeSet.forEach((node) => node.validateDefinition());
    }

    // container (has access to the nodes' definition)
    {
      const containerConfig = config.container;
      const containerConfigPath = utils.addPath(configPath, 'container');

      const container =
        utils.resolveThunkable(containerConfig, this, containerConfigPath) ??
        Object.create(null);

      if (typeof container !== 'object') {
        throw new utils.UnexpectedValueError('an object', container, {
          path: containerConfigPath,
        });
      }

      const servicesByNode = new Map(
        this.nodeSet
          .values()
          .reduce<[Node, ReadonlyMap<utils.Name, any>][]>((entries, node) => {
            if (node.servicesByName.size) {
              entries.push([node, node.servicesByName]);
            }

            return entries;
          }, []),
      );

      this.container = Object.freeze(
        servicesByNode.size
          ? Object.assign(container, { servicesByNode })
          : container,
      );
    }

    /**
     * In order to fail as soon as possible, we validate/build everything right away.
     * It is done step by step in order to have meaningful errors.
     */
    {
      // Validate the nodes' types
      utils.aggregateGraphError<Node, void>(
        this.nodeSet,
        (_, node) => node.validateTypes(),
        undefined,
        { path: configPath },
      );

      // Validate the nodes' operations
      utils.aggregateGraphError<Node, void>(
        this.nodeSet,
        (_, node) => node.validateOperations(),
        undefined,
        { path: configPath },
      );
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

    // max-node-changes
    {
      this.maxNodeChanges = config.maxNodeChanges ?? undefined;
    }

    // connector
    {
      this.#connector =
        utils.resolveThunkable(
          config.connector,
          this,
          utils.addPath(configPath, 'connector'),
        ) || undefined;
    }

    // broker
    {
      this.broker = (utils.resolveThunkable(
        config.broker,
        this,
        utils.addPath(configPath, 'broker'),
      ) ||
        this.#connector?.broker ||
        new InMemoryBroker(this)) as any;
    }

    // on
    {
      const onConfig = config.on;
      const onConfigPath = utils.addPath(configPath, 'on');

      const on = utils.resolveThunkable(onConfig, this, onConfigPath);

      if (on != null) {
        if (typeof on !== 'object') {
          throw new utils.UnexpectedValueError('an object', on, {
            path: onConfigPath,
          });
        }

        this.on(on);
      }
    }
  }

  public getNodeByName(
    name: Node['name'],
    path?: utils.Path,
  ): Node<TRequestContext, TConnector, TBroker, TContainer> {
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

  public ensureNode(
    nodeOrName: Node | Node['name'],
    path?: utils.Path,
  ): Node<TRequestContext, TConnector, TBroker, TContainer> {
    if (typeof nodeOrName === 'string') {
      return this.getNodeByName(nodeOrName, path);
    } else if (nodeOrName instanceof Node && this.nodeSet.has(nodeOrName)) {
      return nodeOrName;
    }

    throw new utils.UnexpectedValueError(
      `a node among "${[...this.nodesByName.keys()].join(', ')}"`,
      String(nodeOrName),
      { path },
    );
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
    } catch (cause) {
      throw new InvalidRequestContextError(maybeRequestContext, {
        cause,
        path,
      });
    }
  }

  @MGetter
  public get connector(): TConnector {
    if (!this.#connector) {
      throw new utils.GraphError(`No connector has been provided`, {
        path: utils.addPath(this.configPath, 'connector'),
      });
    }

    return this.#connector;
  }

  public async seed(
    context: TRequestContext,
    fixtures: NodeFixtureDataByReferenceByNodeName,
  ): Promise<void> {
    const seeding = new Seeding(this, fixtures);
    await seeding.load(context);
  }

  @MGetter
  public get nodeOperationsByNameByType(): OperationsByNameByType<TRequestContext> {
    return Object.fromEntries(
      utils.operationTypes.map((type): any => [
        type,
        new Map(
          this.nodesByName
            .values()
            .flatMap((node) =>
              node.operationsByType[type].map((operation) => [
                operation.name,
                operation,
              ]),
            ),
        ),
      ]),
    ) as any;
  }

  public getOperationByTypeAndName(
    type: graphql.OperationTypeNode,
    name: string,
    path?: utils.Path,
  ): Operation<TRequestContext> {
    const operationsByName = this.nodeOperationsByNameByType[type];
    if (!operationsByName) {
      throw new utils.UnexpectedValueError(
        `a type among "${Object.keys(this.nodeOperationsByNameByType).join(', ')}"`,
        type,
        { path },
      );
    }

    const operation = operationsByName.get(name);
    if (!operation) {
      throw new utils.UnexpectedValueError(
        `a name among "${[...operationsByName.keys()].join(', ')}"`,
        name,
        { path },
      );
    }

    return operation;
  }

  @MGetter
  public get schema(): graphql.GraphQLSchema {
    const schema = new graphql.GraphQLSchema({
      ...this.config.schema,

      ...Object.fromEntries(
        utils.operationTypes
          .map((type): [string, graphql.GraphQLObjectType] | undefined => {
            const fields: graphql.GraphQLFieldConfigMap<any, any> = {
              // Core-operations
              ...(this.nodeOperationsByNameByType[type]?.size &&
                Object.fromEntries(
                  [...this.nodeOperationsByNameByType[type].values()]
                    .filter((operation) => operation.isPublic())
                    .map((operation) => [
                      operation.name,
                      operation.getGraphQLFieldConfig(),
                    ]),
                )),

              // Custom-operations
              ...getCustomOperationsByNameByType(
                this,
                type,
                this.config.customOperations,
                utils.addPath(this.configPath, 'customOperations'),
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

  /**
   * Make it easy to call the operations, either through the "GraphAPI" or the "NodeAPI":
   *
   * @example
   * const articles = await api.Article.findMany(myRequestContext, { where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  @MGetter
  public get api(): API<TRequestContext> {
    return createAPI(this);
  }

  /**
   * Returns a "context"-bound API, so you only have to provide the operations' args:
   *
   * @example
   * const articles = await api.Article.findMany({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  public createContextBoundAPI(
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
  ): ContextBoundAPI {
    return createContextBoundAPI(this, context);
  }

  /**
   * Given a request-context, will execute the task in an operation-context
   */
  public async withOperationContext<TResult>(
    requestContext: TRequestContext,
    task: (
      operationContext: OperationContext<
        TRequestContext,
        TConnector,
        TBroker,
        TContainer
      >,
    ) => Promisable<TResult>,
    path?: utils.Path,
  ): Promise<TResult> {
    this.assertRequestContext(requestContext, path);

    using operationContext = new OperationContext(this, requestContext);

    try {
      return await task(operationContext);
    } catch (rawError) {
      throw utils.castToError(rawError);
    }
  }

  /**
   * Given a request-context, will execute the task in a mutation-context then handle the node-changes at the end in case of success
   */
  public async withMutationContext<TResult>(
    requestContext: TRequestContext,
    task: (
      mutationContext: MutationContext<
        TRequestContext,
        TConnector,
        TBroker,
        TContainer
      >,
    ) => Promisable<TResult>,
    path?: utils.Path,
  ): Promise<TResult> {
    this.assertRequestContext(requestContext, path);

    using mutationContext = new MutationContext(this, requestContext);

    try {
      await this.connector.preMutation?.(mutationContext);
    } catch (cause) {
      throw new ConnectorWorkflowError(
        requestContext,
        ConnectorWorkflowKind.PRE_MUTATION,
        { cause, path },
      );
    }

    let result: TResult;

    try {
      result = await task(mutationContext);

      try {
        await this.connector.postSuccessfulMutation?.(mutationContext);
      } catch (cause) {
        throw new ConnectorWorkflowError(
          requestContext,
          ConnectorWorkflowKind.POST_SUCCESSFUL_MUTATION,
          { cause, path },
        );
      }
    } catch (rawError) {
      const error = utils.castToError(rawError);

      try {
        await this.connector.postFailedMutation?.(mutationContext, error);
      } catch (cause) {
        throw new ConnectorWorkflowError(
          requestContext,
          ConnectorWorkflowKind.POST_FAILED_MUTATION,
          { cause, path },
        );
      }

      throw error;
    } finally {
      try {
        await this.connector.postMutation?.(mutationContext);
      } catch (cause) {
        throw new ConnectorWorkflowError(
          requestContext,
          ConnectorWorkflowKind.POST_MUTATION,
          { cause, path },
        );
      }
    }

    if (mutationContext.changes.size) {
      mutationContext.changes.commit();

      opentelemetry.trace.getActiveSpan()?.addEvent(
        'Commited changes',
        Object.fromEntries(
          mutationContext.changes.changesByNode
            .entries()
            .flatMap(([node, { creation, update, deletion }]) =>
              (
                [
                  [`changes.${node}.creations`, creation.size],
                  [`changes.${node}.updates`, update.size],
                  [`changes.${node}.deletions`, deletion.size],
                ] as const
              ).filter(([_, value]) => value > 0),
            ),
        ),
      );

      try {
        await Promise.all([
          this.emit('node-changes', mutationContext.changes),
          this.broker.publish(mutationContext.changes),
        ]);
      } catch (cause) {
        throw new ChangesNotificationError(
          requestContext,
          mutationContext.changes,
          { cause, path },
        );
      }
    }

    return result;
  }
}
