import {
  FlagConfig,
  getFlagValue,
  loadModuleMap,
  Maybe,
  MaybePromise,
  Merge,
  mergeWith,
  ModuleMapConfig,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { ExecutionResult, graphql, GraphQLArgs, GraphQLFieldConfig, GraphQLSchema } from 'graphql';
import { Binding } from 'graphql-binding';
import { ExecutionResultDataDefault } from 'graphql/execution/execute';
import { Memoize } from 'typescript-memoize';
import { Logger } from 'winston';
import { ConnectorInterface } from './graphql-platform/connector';
import { Fixture, FixtureData, FixtureGraph } from './graphql-platform/fixture';
import { OperationContext } from './graphql-platform/operation';
import {
  MaybeResourceMapAware,
  Resource,
  ResourceConfig,
  ResourceGraph,
  ResourceMap,
  ResourceSet,
} from './graphql-platform/resource';
import { GraphQLSchemaConfig } from './graphql-platform/schema';

export * from './graphql-platform/connector';
export * from './graphql-platform/fixture';
export * from './graphql-platform/operation';
export * from './graphql-platform/resource';
export * from './graphql-platform/schema';
export * from './graphql-platform/type';

/** "Context" provided by the GraphQL Platform */
export interface BaseContext {
  // The logger, if any
  logger: Logger | undefined;

  // Either we are in debug mode or not
  debug: boolean;

  // This API's binding, in order to execute other requests
  api: Binding;
}

/** "Context" provided by the GraphQL Platform's user, can't override the "BaseContext"'s properties */
export interface CustomContext {
  [key: string]: any;
}

/** "Context" available in the operations, hooks... */
export type Context<TCustomContext extends CustomContext = any, TBaseContext extends BaseContext = any> = Readonly<
  TBaseContext & TCustomContext
>;

export type Request = Merge<Omit<GraphQLArgs, 'schema'>, { contextValue?: CustomContext }>;

export type CustomOperationConfig<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any
> = MaybeResourceMapAware<GraphQLFieldConfig<any, Context<TCustomContext, TBaseContext>>>;

export interface GraphQLPlatformConfig<
  TContextParams extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = BaseContext,
  TOperationContext extends OperationContext = OperationContext,
  TResourceConfig extends ResourceConfig<any, any, any, any, any, any> = ResourceConfig<
    TCustomContext,
    TBaseContext,
    TOperationContext
  >
> {
  /** Optional, provide your own logger to see what happens under the hood */
  logger?: Maybe<Logger>;

  /** Optional, default: true but in "production" and "test" env */
  debug?: FlagConfig;

  /** Optional, provide a context you can use in the virtual fields and custom operations' resolver */
  context?: Maybe<(params?: TContextParams) => MaybePromise<TCustomContext>>;

  /** Optional, fine-tune all the resources at once */
  default?: Maybe<(resourceName: Resource['name']) => TResourceConfig>;

  /** Optional, provide some resource configs */
  resources?: ModuleMapConfig<TResourceConfig>;

  /** Optional, provide some custom queries */
  queries?: ModuleMapConfig<CustomOperationConfig<TCustomContext, TBaseContext>>;

  /** Optional, provide some custom mutations */
  mutations?: ModuleMapConfig<CustomOperationConfig<TCustomContext, TBaseContext>>;
}

export type AnyGraphQLPlatformConfig = GraphQLPlatformConfig<any, any, any, any, any>;

export class GraphQLPlatform<
  TContextParams extends POJO = any,
  TCustomContext extends CustomContext = any,
  TConfig extends AnyGraphQLPlatformConfig = GraphQLPlatformConfig<TContextParams, TCustomContext>
> {
  public constructor(readonly config: TConfig) {}

  @Memoize()
  public getLogger(): Logger | undefined {
    return this.config.logger || undefined;
  }

  @Memoize()
  public getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  @Memoize()
  public isDebug(): boolean {
    return getFlagValue(this.config.debug, !['production', 'test'].includes(this.getEnvironment()));
  }

  @Memoize()
  public getResourceMap(): ResourceMap {
    const resourceMap = new ResourceMap();

    for (const [resourceName, resourceConfig] of loadModuleMap(this.config.resources)) {
      // Generate the default config by providing the resource's name
      const defaultResourceConfig = this.config.default ? this.config.default(resourceName) : undefined;

      // Process the configs merging, the resource's config prevails over the default one.
      const mergedResourceConfig = defaultResourceConfig
        ? mergeWith({}, defaultResourceConfig, resourceConfig)
        : resourceConfig;

      resourceMap.set(resourceName, new Resource(resourceName, mergedResourceConfig, this));
    }

    return resourceMap;
  }

  @Memoize()
  public getResourceSet(): ResourceSet {
    return new ResourceSet(this.getResourceMap().values());
  }

  @Memoize()
  public getResourceGraph(): ResourceGraph {
    const graph = new ResourceGraph({ circular: false });

    for (const resource of this.getResourceSet()) {
      graph.addNode(resource.name, resource);
    }

    for (const resource of this.getResourceSet()) {
      for (const relation of resource.getRelationSet()) {
        if (relation.getFrom() !== relation.getTo()) {
          graph.addDependency(relation.getFrom().name, relation.getTo().name);
        }
      }
    }

    return graph;
  }

  @Memoize()
  public getGraphQLSchemaConfig(): GraphQLSchemaConfig {
    const resourceMap = this.getResourceMap();

    return new GraphQLSchemaConfig({
      resourceMap,
      queryMap: this.config.queries
        ? [...loadModuleMap(this.config.queries)].reduce(
            (operationMap, [name, config]) =>
              Object.assign(operationMap, { [name]: typeof config === 'function' ? config({ resourceMap }) : config }),
            {},
          )
        : {},
      mutationMap: this.config.mutations
        ? [...loadModuleMap(this.config.mutations)].reduce(
            (operationMap, [name, config]) =>
              Object.assign(operationMap, { [name]: typeof config === 'function' ? config({ resourceMap }) : config }),
            {},
          )
        : {},
    });
  }

  @Memoize()
  public getGraphQLSchema(): GraphQLSchema {
    return new GraphQLSchema(this.getGraphQLSchemaConfig());
  }

  @Memoize()
  public getBinding(): Binding {
    return new Binding({ schema: this.getGraphQLSchema() });
  }

  public async getCustomContext(params?: any): Promise<CustomContext> {
    return this.config.context ? this.config.context(params) : {};
  }

  public async getBaseContext(): Promise<BaseContext> {
    return {
      logger: this.getLogger(),
      debug: this.isDebug(),
      api: this.getBinding(),
    };
  }

  public async getContext(params?: any): Promise<Context<CustomContext, BaseContext>> {
    const [custom, base] = await Promise.all([this.getCustomContext(params), this.getBaseContext()]);

    return Object.freeze({
      ...custom,
      ...base,
    });
  }

  public async execute<TData = ExecutionResultDataDefault>(request: Request): Promise<ExecutionResult<TData>> {
    return graphql<TData>({
      ...request,
      schema: this.getGraphQLSchema(),
      contextValue: {
        ...(await this.getContext()),
        ...request.contextValue,
      },
    });
  }

  @Memoize()
  public getConnector(): ConnectorInterface {
    return {
      find() {
        throw new Error(`The "find" operation is not implemented, yet.`);
      },
      count() {
        throw new Error(`The "count" operation is not implemented, yet.`);
      },
      create() {
        throw new Error(`The "create" operation is not implemented, yet.`);
      },
      update() {
        throw new Error(`The "update" operation is not implemented, yet.`);
      },
      delete() {
        throw new Error(`The "delete" operation is not implemented, yet.`);
      },
    };
  }

  // Gets the fixtures, sorted by their dependencies
  public getFixtureGraph(config: ModuleMapConfig<ModuleMapConfig<FixtureData>>): FixtureGraph {
    const fixtureGraph = new FixtureGraph({ circular: false });

    for (const [resourceName, fixtureDataMap] of loadModuleMap(config)) {
      const resource = this.getResourceMap().assert(resourceName);
      for (const [fixtureName, fixtureData] of loadModuleMap(fixtureDataMap)) {
        if (fixtureGraph.hasNode(fixtureName)) {
          const fixture = fixtureGraph.getNodeData(fixtureName);

          throw new Error(`At least 2 fixtures have the same name: "${resource}.${fixtureName}" and "${fixture}"`);
        }

        const fixture = new Fixture(fixtureName, resource, fixtureData, fixtureGraph, this);

        fixtureGraph.addNode(fixture.name, fixture);
      }
    }

    // Sort the fixtures
    for (const fixtureName of fixtureGraph.overallOrder()) {
      const fixture = fixtureGraph.getNodeData(fixtureName);

      for (const relation of fixture.resource.getRelationSet()) {
        const relatedFixture = fixture.getRelatedFixture(relation);
        if (relatedFixture) {
          fixtureGraph.addDependency(fixture.name, relatedFixture.name);
        }
      }
    }

    return fixtureGraph;
  }

  public async loadFixtures(
    config: ModuleMapConfig<ModuleMapConfig<FixtureData>>,
    contextValue?: Request['contextValue'],
  ): Promise<void> {
    const fixtureGraph = this.getFixtureGraph(config);

    // Actually load the fixtures
    for (const fixtureName of fixtureGraph.overallOrder()) {
      await fixtureGraph.getNodeData(fixtureName).load();
    }
  }
}

export type AnyGraphQLPlatform = GraphQLPlatform<any, any, any>;
