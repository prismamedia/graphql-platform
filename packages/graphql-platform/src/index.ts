import {
  addPath,
  aggregateConfigError,
  assertPlainObjectConfig,
  castToError,
  ConfigError,
  isConstructor,
  isPlainObject,
  operationTypes,
  UnexpectedConfigError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { Constructor, Except } from 'type-fest';
import type { ConnectorInterface } from './connector-interface.js';
import {
  getCustomOperationMap,
  type CustomOperationMap,
} from './custom-operations.js';
import {
  createAPI,
  InvalidContextError,
  Node,
  type API,
  type NodeConfig,
  type NodeName,
  type OperationInterface,
  type OperationsByNameByType,
} from './node.js';
import { NodeFixtureDataByReferenceByNodeName, Seeding } from './seeding.js';

export * from './connector-interface.js';
export * from './custom-operations.js';
export * from './node.js';
export * from './seeding.js';

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
        Constructor<TConnector, [GraphQLPlatform, TConnector['config'], Path]>,
        TConnector['config'],
      ];

  /**
   * Optional, a method which asserts the request context validity
   *
   * Convenient when the GraphQL Platform is used with multiple integrations and you want to validate its context
   *
   * By default, the context provided by the integration is provided "as is"
   *
   * @see: https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument
   */
  assertRequestContext?(
    maybeRequestContext: unknown,
  ): asserts maybeRequestContext is TRequestContext;
};

export class GraphQLPlatform<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly nodesByName: ReadonlyMap<
    Node['name'],
    Node<TRequestContext, TConnector>
  >;
  public readonly operationsByNameByType: OperationsByNameByType<
    TRequestContext,
    TConnector
  >;
  public readonly api: API<TRequestContext, TConnector>;
  readonly #connector?: TConnector;

  public constructor(
    public readonly config: GraphQLPlatformConfig<TRequestContext, TConnector>,
    public readonly configPath: Path = addPath(
      undefined,
      'GraphQLPlatformConfig',
    ),
  ) {
    assertPlainObjectConfig(config, configPath);

    // nodes
    {
      const nodesConfig = config.nodes;
      const nodesConfigPath = addPath(configPath, 'nodes');

      if (!isPlainObject(nodesConfig) || !Object.entries(nodesConfig).length) {
        throw new UnexpectedConfigError(`at least one "node"`, nodesConfig, {
          path: nodesConfigPath,
        });
      }

      this.nodesByName = new Map(
        aggregateConfigError<
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
                addPath(nodesConfigPath, nodeName),
              ),
            ],
          ],
          [],
          { path: nodesConfigPath },
        ),
      );

      /**
       * In order to fail as soon as possible, we validate/build everything right away.
       * It is done step by step in order to have meaningful errors.
       */
      {
        aggregateConfigError<Node, void>(
          this.nodesByName.values(),
          (_, node) => node.validateDefinition(),
          undefined,
          { path: nodesConfigPath },
        );

        aggregateConfigError<Node, void>(
          this.nodesByName.values(),
          (_, node) => node.validateTypes(),
          undefined,
          { path: nodesConfigPath },
        );

        aggregateConfigError<Node, void>(
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
        operationTypes.map((type): any => [
          type,
          new Map(
            Array.from(this.nodesByName.values()).flatMap((node) =>
              node.operations
                .filter((operation) => operation.operationType === type)
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
      const connectorConfigPath = addPath(this.configPath, 'connector');

      this.#connector = connectorConfig
        ? isConstructor<TConnector, [GraphQLPlatform]>(connectorConfig)
          ? new connectorConfig(this)
          : Array.isArray(connectorConfig)
          ? connectorConfig.length
            ? new connectorConfig[0](
                this,
                connectorConfig[1],
                addPath(connectorConfigPath, 1),
              )
            : undefined
          : connectorConfig
        : undefined;
    }
  }

  public getNodeByName(
    name: Node['name'],
    path?: Path,
  ): Node<TRequestContext, TConnector> {
    const node = this.nodesByName.get(name);
    if (!node) {
      throw new UnexpectedValueError(
        `a node's name among "${[...this.nodesByName.keys()].join(', ')}"`,
        name,
        { path },
      );
    }

    return node;
  }

  public getOperationByTypeAndName(
    type: graphql.OperationTypeNode,
    name: string,
    path?: Path,
  ): OperationInterface<TRequestContext, TConnector> {
    if (!operationTypes.includes(type)) {
      throw new UnexpectedValueError(
        `an operation's type among "${operationTypes.join(', ')}"`,
        type,
        { path },
      );
    }

    const operation = this.operationsByNameByType[type].get(name);
    if (!operation) {
      throw new UnexpectedValueError(
        `an operation's name among "${[
          ...this.operationsByNameByType[type].keys(),
        ].join(', ')}"`,
        name,
        { path },
      );
    }

    return operation;
  }

  @Memoize()
  public get schema(): graphql.GraphQLSchema {
    const schema = new graphql.GraphQLSchema({
      ...this.config.schema,

      ...Object.fromEntries(
        operationTypes.map((type) => {
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

  @Memoize()
  public get connector(): TConnector {
    if (!this.#connector) {
      throw new ConfigError(`No connector has been provided`, {
        path: addPath(this.configPath, 'connector'),
      });
    }

    return this.#connector;
  }

  public assertRequestContext(
    maybeRequestContext: unknown,
    path?: Path,
  ): asserts maybeRequestContext is TRequestContext {
    try {
      if (
        typeof maybeRequestContext !== 'object' ||
        maybeRequestContext === null
      ) {
        throw new UnexpectedValueError('an object', maybeRequestContext, {
          path,
        });
      }

      this.config.assertRequestContext?.(maybeRequestContext);
    } catch (error) {
      throw new InvalidContextError({
        cause: castToError(error),
        path,
      });
    }
  }

  public async seed(
    fixtures: NodeFixtureDataByReferenceByNodeName,
    context: TRequestContext,
    reset: boolean = false,
  ): Promise<void> {
    const seeding = new Seeding(this, fixtures);

    if (reset) {
      await this.connector.reset?.();
    }

    await seeding.load(context);
  }
}
