import {
  didYouMean,
  fromObjectEntries,
  getOptionalFlag,
  isNonEmptyPlainObject,
  mapObjectValues,
  MaybePathAwareError,
  operationTypes,
  OptionalFlag,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidSchema,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLSchemaConfig,
  OperationTypeNode,
} from 'graphql';
import { Except } from 'type-fest';
import { ConnectorInterface } from './connector';
import { CustomOperationMap, getCustomOperationMap } from './custom-operations';
import {
  catchDefinitionError,
  DefinitionError,
  ModelDefinitionError,
} from './errors';
import {
  Model,
  ModelConfig,
  OperationKey,
  OperationParameters,
  OperationResult,
} from './model';
import { Operation } from './model/operations';

export * from './connector';
export * from './custom-operations';
export * from './errors';
export * from './model';

export type API<TRequestContext, TConnector extends ConnectorInterface> = {
  [TKey in OperationKey]: (
    modelName: string,
    ...params: OperationParameters<TKey, TRequestContext, TConnector>
  ) => OperationResult<TKey>;
};

// export type ContextProvider<
//   TIntegrationContext = unknown,
//   TRequestContext = unknown
// > = (integrationContext: TIntegrationContext) => Promisable<TRequestContext>;

export type GraphQLPlatformConfig<
  TRequestContext = undefined,
  TConnector extends ConnectorInterface = any,
> = {
  /**
   * Optional, either the schema is exposed publicly (= the GraphQL API) or not (= the internal API)
   *
   * Default: true
   */
  public?: OptionalFlag;

  // /**
  //  * Optional, given the "integration context" provided by your integration (Apollo Server for exemple) compute the "request context" available in the models' "filter", "parsers", "custom fields' resolver" and so on...
  //  *
  //  * By default, the "integration context" is provided "as is"
  //  *
  //  * Convenient when the schema is used with multiple integrations and you want to ensure the validity of
  //  *
  //  * @see: https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument
  //  */
  // context?: ContextProvider<any, TRequestContext>;

  /**
   * Required, provide the models' definition
   */
  models: {
    /**
     * The models' name are expected to be provided in "PascalCase" and to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [modelName: string]: ModelConfig<TRequestContext, TConnector>;
  };

  /**
   * Optional, add some "custom" operations
   */
  customOperations?: CustomOperationMap<TRequestContext, TConnector>;

  /**
   * Optional, fine-tune the generated GraphQL Schema
   */
  schema?: Except<GraphQLSchemaConfig, OperationTypeNode>;

  /**
   * Optional, provide a connector to let the schema be executable
   */
  connector?: TConnector;
};

export class GraphQLPlatform<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly public: boolean;
  public readonly modelMap: ReadonlyMap<
    string,
    Model<TRequestContext, TConnector>
  >;
  public readonly operations: Readonly<
    {
      [TOperationType in OperationTypeNode]: Readonly<
        Record<string, Extract<Operation, { type: TOperationType }>>
      >;
    }
  >;
  readonly #connector?: TConnector;

  public constructor(
    public readonly config: GraphQLPlatformConfig<TRequestContext, TConnector>,
  ) {
    // visibility
    this.public = catchDefinitionError(
      () => getOptionalFlag(config.public, true),
      (error) => new DefinitionError(`expects a valid public value`, error),
    );

    // models
    {
      if (!isNonEmptyPlainObject(config.models)) {
        throw new DefinitionError(`expects at least one model to be defined`);
      }

      this.modelMap = new Map(
        Object.entries(config.models).map(([name, config]) => [
          name,
          // Catch the "uncaught" errors
          catchDefinitionError(
            () => new Model(this, name, config),
            (error) => new ModelDefinitionError(name, error),
          ),
        ]),
      );

      // We have this "validation" step after all the references are made in order to avoid "circular references" issues
      this.modelMap.forEach((model) =>
        catchDefinitionError(
          () => model.validate(),
          (error) => new ModelDefinitionError(model, error),
        ),
      );
    }

    // operations
    {
      this.operations = fromObjectEntries(
        operationTypes.map((operationType) => [
          operationType,
          fromObjectEntries(
            (<[string, Operation | undefined][]>[]).concat(
              ...[...this.modelMap.values()].map((model) =>
                (<[string, Operation | undefined][]>[]).concat(
                  ...Object.values(model.operationMap).map<
                    [string, Operation | undefined]
                  >((operation) => [
                    operation.name,
                    operation.type === operationType && operation.enabled
                      ? operation
                      : undefined,
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ) as this['operations'];
    }

    this.#connector = this.config.connector;
    this.#connector?.connect?.(this);
  }

  public getModel(
    name: string,
    path?: Path,
  ): Model<TRequestContext, TConnector> {
    const model = this.modelMap.get(name);
    if (!model) {
      throw new MaybePathAwareError(
        `The "${name}" model does not exist, did you mean: ${didYouMean(
          name,
          this.modelMap.keys(),
        )}`,
        path,
      );
    }

    return model;
  }

  @Memoize()
  public get schema(): GraphQLSchema {
    assert(this.public, `The GraphQL Platform is private`);

    const schema = new GraphQLSchema({
      ...this.config.schema,
      ...mapObjectValues<
        Record<string, Operation>,
        GraphQLObjectType,
        OperationTypeNode
      >(this.operations, (operations, operationType) => {
        const fieldConfigMap: GraphQLFieldConfigMap<any, any> = {
          // GraphQL Platform operations
          ...mapObjectValues<
            Operation,
            GraphQLFieldConfig<any, any, any>,
            string
          >(operations, (operation) =>
            operation.public ? operation.graphqlFieldConfig : undefined,
          ),

          // Custom operations
          ...getCustomOperationMap(
            this,
            this.config.customOperations,
            operationType,
          ),
        };

        return Object.keys(fieldConfigMap).length > 0
          ? new GraphQLObjectType({
              name: operationType,
              fields: fieldConfigMap,
            })
          : undefined;
      }),
    });

    assertValidSchema(schema);

    return schema;
  }

  @Memoize()
  public get connector(): TConnector {
    if (!this.#connector) {
      throw new Error(`No connector has been provided`);
    }

    return this.#connector;
  }

  @Memoize()
  public get api(): API<TRequestContext, TConnector> {
    return new Proxy({} as any, {
      get:
        (_, operationKey: OperationKey) =>
        (modelName: string, ...params: any[]) =>
          this.getModel(modelName)
            .getOperation<any>(operationKey)
            .execute(...params),
    });
  }
}
