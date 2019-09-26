import {
  addPath,
  didYouMean,
  fromObjectEntries,
  getObjectEntries,
  getObjectKeys,
  getOptionalFlagValue,
  MaybePathAwareError,
  OptionalFlagValue,
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
import { Edge, Leaf, Node, TNodeConfig } from './node';

export * from './connector';
export * from './custom-operations';
export * from './node';
export * from './operations';

export interface IGraphQLPlatformConfig<
  TContext = undefined,
  TConnector extends IConnector = IConnector
> {
  /**
   * Optional, either the API is exposed publicly or not
   *
   * Default: true
   */
  public?: OptionalFlagValue;

  /**
   * Required, provide the nodes' definition
   */
  nodes: {
    /**
     * The "node"'s name is expected to be provided in "PascalCase"
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

  public readonly nodeMap: ReadonlyMap<string, Node<TContext, TConnector>>;

  public readonly schema: GraphQLSchema;

  readonly #connector?: TConnector;

  public constructor(
    public readonly config: IGraphQLPlatformConfig<TContext, TConnector>,
  ) {
    this.public = getOptionalFlagValue(config.public, true);

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

    // Resolves some "lazy" properties in order to validate the definitions
    this.nodeMap.forEach((node) => {
      node.public;
      node.componentMap.forEach((component) => {
        component.public;
        if (component instanceof Edge) {
          component.reference;
        }
      });
      node.reverseEdgeMap.forEach((reverseEdge) => {
        reverseEdge.public;
        reverseEdge.unique;
      });
    });

    const operations: Record<
      OperationTypeNode,
      GraphQLFieldConfigMap<any, any>
    > = {
      query: {},
      mutation: {},
      subscription: {},
    };

    for (const type of getObjectKeys(operations)) {
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
      ...fromObjectEntries(
        getObjectEntries(operations)
          .filter(([, fields]) => Object.values(fields).length > 0)
          .map(([name, fields]): [OperationTypeNode, GraphQLObjectType] => [
            name,
            new GraphQLObjectType({ name, fields }),
          ]),
      ),
      ...config.schema,
    });

    assertValidSchema(this.schema);

    this.#connector = this.config.connector;
    this.#connector?.connect?.(this);
  }

  public getNode(name: string, path?: Path): Node<TContext, TConnector> {
    if (!this.nodeMap.has(name)) {
      throw new MaybePathAwareError(
        `The "${name}" node does not exist, did you mean: ${didYouMean(
          name,
          this.nodeMap.keys(),
        )}`,
        path,
      );
    }

    return this.nodeMap.get(name)!;
  }

  public getNodeLeaf(id: string, path?: Path): Leaf<TConnector> {
    const [node, leaf] = id.split('.');

    return this.getNode(node, path).getLeaf(leaf, addPath(path, leaf));
  }

  public getNodeEdge(id: string, path?: Path): Edge<TConnector> {
    const [node, edge] = id.split('.');

    return this.getNode(node, path).getEdge(edge, addPath(path, edge));
  }

  public get connector(): TConnector {
    if (!this.#connector) {
      throw new Error(`No connector has been provided`);
    }

    return this.#connector;
  }
}
