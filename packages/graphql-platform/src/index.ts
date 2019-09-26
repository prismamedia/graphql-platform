import {
  didYouMean,
  getOptionalFlag,
  MaybePathAwareError,
  OptionalFlag,
  Path,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import {
  assertValidSchema,
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLSchemaConfig,
  OperationTypeNode,
} from 'graphql';
import { IConnector } from './connector';
import {
  getCustomOperationMap,
  TCustomOperationMap,
} from './custom-operations';
import { Node, TNodeConfig } from './node';

export * from './connector';
export * from './custom-operations';
export * from './node';

export interface IGraphQLPlatformConfig<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> {
  /**
   * Optional, either the API is exposed publicly or not
   *
   * Default: true
   */
  public?: OptionalFlag;

  /**
   * Required, provide the nodes' definition
   */
  nodes: {
    /**
     * The nodes' name are expected to be provided in "PascalCase" and to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [nodeName: string]: TNodeConfig<TContext, TConnector>;
  };

  /**
   * Optional, add some "custom" operations
   */
  customOperations?: TCustomOperationMap<TContext, TConnector>;

  /**
   * Optional, fine-tune the generated GraphQL Schema
   */
  schema?: Omit<GraphQLSchemaConfig, OperationTypeNode>;

  /**
   * Optional, provide a connector to let the schema be executable
   */
  connector?: TConnector;
}

export class GraphQLPlatform<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> {
  public readonly public: boolean;
  public readonly nodeMap: ReadonlyMap<string, Node>;
  public readonly schema: GraphQLSchema;
  readonly #connector?: TConnector;

  public constructor(
    public readonly config: IGraphQLPlatformConfig<TContext, TConnector>,
  ) {
    this.public = getOptionalFlag(config.public, true);

    this.nodeMap = new Map(
      Object.entries(config.nodes).map(([name, config]) => [
        name,
        new Node(this, name, config),
      ]),
    );

    assert(
      this.nodeMap.size > 0,
      `GraphQL Platform expects at least one node to be defined`,
    );

    const operations: Record<
      OperationTypeNode,
      GraphQLFieldConfigMap<any, any>
    > = {
      query: {},
      mutation: {},
      subscription: {},
    };

    for (const type of Object.keys(operations) as OperationTypeNode[]) {
      // Node operations
      for (const node of this.nodeMap.values()) {
        for (const operation of Object.values(node.operationMap)) {
          if (operation.public && operation.type === type) {
            if (operation.name in operations[type]) {
              throw new Error(
                `At least 2 "${type}" operations have the same name "${operation.name}"`,
              );
            }

            Object.assign(operations[type], {
              [operation.name]: operation.graphqlFieldConfig,
            });
          }
        }
      }

      // Custom operations
      Object.assign(
        operations[type],
        getCustomOperationMap(this, this.config.customOperations, type),
      );
    }

    this.schema = new GraphQLSchema({
      ...Object.fromEntries(
        Object.entries(operations)
          .filter(([, fields]) => Object.values(fields).length > 0)
          .map(([type, fields]) => [
            type,
            new GraphQLObjectType({ name: type, fields }),
          ]),
      ),
      ...config.schema,
    });

    assertValidSchema(this.schema);

    this.#connector = this.config.connector;
    this.#connector?.connect?.(this);
  }

  public getNode(name: string, path?: Path): Node {
    const node = this.nodeMap.get(name);
    if (!node) {
      throw new MaybePathAwareError(
        `The "${name}" node does not exist, did you mean: ${didYouMean(
          name,
          this.nodeMap.keys(),
        )}`,
        path,
      );
    }

    return node;
  }

  public get connector(): TConnector {
    if (!this.#connector) {
      throw new Error(`No connector has been provided`);
    }

    return this.#connector;
  }
}
