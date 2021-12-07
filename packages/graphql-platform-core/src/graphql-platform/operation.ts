import {
  Class,
  GraphQLFieldConfig,
  GraphQLOperationType,
  GraphQLSelectionNode,
  Maybe,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import {
  AnyBaseContext,
  BaseContext,
  Context,
  CustomContext,
} from '../graphql-platform';
import {
  CreateOneOperation as CreateOne,
  DeleteOneOperation as DeleteOne,
  UpdateOneOperation as UpdateOne,
  UpsertOneOperation as UpsertOne,
} from './operation/mutation';
import {
  AssertOneOperation as AssertOne,
  CountOperation as Count,
  FindManyOperation as FindMany,
  FindOneOperation as FindOne,
} from './operation/query';
import { Resource } from './resource';

export { executePostHooks } from './operation/abstract-operation';
export * from './operation/error';
export * from './operation/mutation';
export * from './operation/query';

export interface Operation {
  type: GraphQLOperationType;
  id: string;
  resource: Resource;
  name: string;
  isPublic(): boolean;
  getGraphQLFieldConfig(): GraphQLFieldConfig;
}

export enum OperationEventKind {
  // Always triggered
  PreOperation = 'PRE_OPERATION',

  // Triggered on error only
  PostOperationError = 'POST_OPERATION_ERROR',

  // Triggered on success only
  PostOperationSuccess = 'POST_OPERATION_SUCCESS',

  // Always triggered
  PostOperation = 'POST_OPERATION',
}

// A "post operation success hook" has to be bound correctly in order to be called without any argument.
export type PostOperationSuccessHook = () => Promise<void>;

export type OperationContext =
  | {
      type?: Exclude<GraphQLOperationType, GraphQLOperationType.Mutation>;
    }
  | {
      type: GraphQLOperationType.Mutation;

      /**
       * In a "mutation", the fields are resolved serially,
       * We use this behavior to share a variable in which we store the post success hooks
       * cf: https://graphql.github.io/graphql-spec/draft/#sec-Mutation
       */
      postSuccessHooks?: PostOperationSuccessHook[];
    };

export type OperationResolverParams<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext,
> = Readonly<{
  /**
   * The current resolver "args"
   */
  args: TArgs;

  /**
   * The well-known GraphQL context, shared by all the resolvers of the same GraphQL request
   */
  context: Context<TCustomContext, TBaseContext>;

  /**
   * The "selectionNode" is the result of the "GraphQLInfo" object parsing
   */
  selectionNode: GraphQLSelectionNode;
}>;

export type OperationEvent<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext,
> = OperationResolverParams<TArgs, TCustomContext, TBaseContext> &
  Readonly<{
    /**
     * The current operation
     */
    operation: Operation;
  }>;

export type OperationEventMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext,
> = Record<
  OperationEventKind,
  OperationEvent<TArgs, TCustomContext, TBaseContext>
>;

export const operationTypeMap = {
  [GraphQLOperationType.Mutation]: {
    CreateOne,
    DeleteOne,
    UpdateOne,
    UpsertOne,
  },
  [GraphQLOperationType.Query]: { AssertOne, Count, FindMany, FindOne },
};

export type OperationTypeMap = typeof operationTypeMap;

export type OperationType = keyof OperationTypeMap;

export type OperationConstructorMap<TOperationType extends OperationType> =
  OperationTypeMap[TOperationType];

export type OperationId<TOperationType extends OperationType> =
  keyof OperationConstructorMap<TOperationType>;

export type OperationConstructor<
  TType extends OperationType,
  TId extends OperationId<TType>,
> = OperationConstructorMap<TType>[TId] extends Class
  ? OperationConstructorMap<TType>[TId]
  : never;

export type OperationTypeConfig<TType extends GraphQLOperationType> =
  /** Either these operations are enabled (= public) or not, default: true */
  | boolean
  | (TType extends OperationType
      ? {
          /** Optional, fine-tune this operation */
          [TId in keyof OperationConstructorMap<TType>]?: Maybe<boolean>;
        }
      : never);

export type OperationTypeMapConfig =
  /** Either these operations are enabled (= public) or not, default: true */
  | boolean
  | {
      /** Optional, fine-tune the mutations */
      mutations?: Maybe<OperationTypeConfig<GraphQLOperationType.Mutation>>;

      /** Optional, fine-tune the queries */
      queries?: Maybe<OperationTypeConfig<GraphQLOperationType.Query>>;

      /** Optional, fine-tune the subscriptions */
      subscriptions?: Maybe<
        OperationTypeConfig<GraphQLOperationType.Subscription>
      >;
    };
