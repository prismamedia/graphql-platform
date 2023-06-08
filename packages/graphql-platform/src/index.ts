import {
  AsyncEventEmitter,
  type EventConfigByName,
} from '@prismamedia/async-event-emitter';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { Except } from 'type-fest';
import type { ConnectorInterface } from './connector-interface.js';
import {
  getCustomOperationsByNameByType,
  type CustomOperationsByNameByTypeConfig,
} from './custom-operations.js';
import {
  InvalidRequestContextError,
  Node,
  createAPI,
  createContextBoundAPI,
  operationConstructorsByType,
  type API,
  type ContextBoundAPI,
  type NodeChange,
  type NodeChangeAggregation,
  type NodeConfig,
  type NodeName,
  type Operation,
  type OperationByType,
  type OperationContext,
  type OperationInterface,
  type OperationType,
} from './node.js';
import {
  Seeding,
  type NodeFixtureDataByReferenceByNodeName,
} from './seeding.js';

export * from './connector-interface.js';
export * from './custom-operations.js';
export * from './graphql-field-config.js';
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
  TContainer extends object = any,
> = (
  this: GraphQLPlatform<TRequestContext, TConnector, TContainer>,
  maybeRequestContext: object,
) => asserts maybeRequestContext is TRequestContext;

export type EventDataByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = {
  'node-change-aggregation': NodeChangeAggregation<
    TRequestContext,
    TConnector,
    TContainer
  >;
  'node-change': NodeChange<TRequestContext, TConnector, TContainer>;
};

export type ConnectorConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = utils.Thunkable<
  TConnector,
  [gp: GraphQLPlatform<TRequestContext, any, any>, configPath: utils.Path]
>;

export type ContainerConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  TContainer,
  [gp: GraphQLPlatform<TRequestContext, TConnector, {}>, configPath: utils.Path]
>;

export interface GraphQLPlatformConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> {
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
  connector?: ConnectorConfig<TRequestContext, TConnector>;

  /**
   * Optional, given the GraphQL-Platform instance, build a service-container which will be accessible further in the hooks, the virtual-fields and the custom-operations' resolver
   */
  container?: ContainerConfig<TRequestContext, TConnector, TContainer>;

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
    TContainer
  >;

  /**
   * Optional, register some event-listeners, all at once
   */
  on?: utils.Thunkable<
    EventConfigByName<EventDataByName<TRequestContext, TConnector, TContainer>>,
    [
      gp: GraphQLPlatform<TRequestContext, TConnector, TContainer>,
      configPath: utils.Path,
    ]
  >;
}

export class GraphQLPlatform<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> extends AsyncEventEmitter<
  EventDataByName<TRequestContext, TConnector, TContainer>
> {
  public readonly nodesByName: ReadonlyMap<
    Node['name'],
    Node<TRequestContext, TConnector, TContainer>
  >;

  public readonly nodeSet: ReadonlySet<
    Node<TRequestContext, TConnector, TContainer>
  >;

  public readonly operationsByNameByType: OperationsByNameByType<TRequestContext>;

  readonly #connector?: TConnector;

  public readonly container: Readonly<TContainer>;

  readonly #requestContextAssertion?: (
    maybeRequestContext: object,
  ) => asserts maybeRequestContext is TRequestContext;

  /**
   * Make it easy to call the operations, either through the "GraphAPI" or the "NodeAPI":
   *
   * @example <caption>GraphAPI</caption>
   * const articles = await api.query.articles(myRequestContext, { where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   *
   * @example <caption>NodeAPI</caption>
   * const articles = await api.Article.findMany(myRequestContext, { where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  public readonly api: API<TRequestContext>;

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

    super();

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

      this.nodesByName = new Map(
        utils.aggregateGraphError<
          [Node['name'], NodeConfig],
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

      this.nodeSet = new Set(this.nodesByName.values());

      /**
       * In order to fail as soon as possible, we validate/build everything right away.
       * It is done step by step in order to have meaningful errors.
       */
      {
        utils.aggregateGraphError<Node, void>(
          this.nodesByName.values(),
          (_, node) => node.validateDefinition(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateGraphError<Node, void>(
          this.nodesByName.values(),
          (_, node) => node.validateTypes(),
          undefined,
          { path: nodesConfigPath },
        );

        utils.aggregateGraphError<Node, void>(
          this.nodesByName.values(),
          (_, node) => node.validateOperations(),
          undefined,
          { path: nodesConfigPath },
        );
      }
    }

    // operations
    {
      this.operationsByNameByType = Object.fromEntries(
        (Object.keys(operationConstructorsByType) as OperationType[]).map(
          (type): any => [
            type,
            new Map(
              Array.from(this.nodesByName.values()).flatMap((node) =>
                node.operationsByType[type].map((operation) => [
                  operation.name,
                  operation,
                ]),
              ),
            ),
          ],
        ),
      ) as OperationsByNameByType;
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

    // connector
    {
      const connectorConfig = config.connector;
      const connectorConfigPath = utils.addPath(configPath, 'connector');

      this.#connector = utils.resolveThunkable(
        connectorConfig,
        this,
        connectorConfigPath,
      );
    }

    // container
    {
      const containerConfig = config.container;
      const containerConfigPath = utils.addPath(configPath, 'container');

      const container = utils.resolveThunkable(
        containerConfig,
        this,
        containerConfigPath,
      );

      if (container != null) {
        if (typeof container !== 'object') {
          throw new utils.UnexpectedValueError('an object', container, {
            path: containerConfigPath,
          });
        }

        this.container = Object.freeze(container);
      } else {
        this.container = Object.freeze({} as TContainer);
      }
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

    // API
    {
      this.api = createAPI(this);
    }
  }

  public getNodeByName(
    name: Node['name'],
    path?: utils.Path,
  ): Node<TRequestContext, TConnector, TContainer> {
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
  ): Node<TRequestContext, TConnector, TContainer> {
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

  public getOperationByTypeAndName(
    type: graphql.OperationTypeNode,
    name: string,
    path?: utils.Path,
  ): OperationInterface<TRequestContext> {
    const operationsByName = this.operationsByNameByType[type];
    if (!operationsByName) {
      throw new utils.UnexpectedValueError(
        `a type among "${Object.keys(this.operationsByNameByType).join(', ')}"`,
        type,
        { path },
      );
    }

    const operation = operationsByName.get(name);
    if (!operation) {
      throw new utils.UnexpectedValueError(
        `a ${type} among "${[...operationsByName.keys()].join(', ')}"`,
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
    } catch (cause) {
      throw new InvalidRequestContextError({ cause, path });
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
    context: TRequestContext,
    fixtures: NodeFixtureDataByReferenceByNodeName,
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
              ...(this.operationsByNameByType[type]?.size &&
                Object.fromEntries(
                  [...this.operationsByNameByType[type].values()]
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
   * Returns a "context"-bound API, so you only have to provide the operations' args:
   *
   * @example <caption>GraphAPI</caption>
   * const articles = await api.query.articles({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   *
   * @example <caption>NodeAPI</caption>
   * const articles = await api.Article.findMany({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  public createContextBoundAPI(
    context:
      | utils.Thunkable<TRequestContext>
      | OperationContext<TRequestContext>,
  ): ContextBoundAPI {
    return createContextBoundAPI(this, context);
  }
}
