import {
  Class,
  GraphQLFieldConfig,
  GraphQLOperationType,
  GraphQLSelectionNode,
  Maybe,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { BaseContext, Context, CustomContext } from '../graphql-platform';
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

export interface OperationContext extends POJO {
  postSuccessHooks: PostOperationSuccessHook[];
}

export type OperationResolverParams<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
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
   * A new "operationContext" is created for every resolver execution
   */
  operationContext: TOperationContext;

  /**
   * The "selectionNode" is the result of the "GraphQLInfo" object parsing
   */
  selectionNode: GraphQLSelectionNode<any>;
}>;

export type OperationEvent<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = OperationResolverParams<TArgs, TCustomContext, TBaseContext, TOperationContext> &
  Readonly<{
    /**
     * The current operation
     */
    operation: Operation;
  }>;

export interface OperationEventMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> {
  [OperationEventKind.PreOperation]: OperationEvent<TArgs, TCustomContext, TBaseContext, TOperationContext>;
  [OperationEventKind.PostOperationSuccess]: OperationEvent<TArgs, TCustomContext, TBaseContext, TOperationContext>;
  [OperationEventKind.PostOperationError]: OperationEvent<TArgs, TCustomContext, TBaseContext, TOperationContext> &
    Readonly<{ error: Error }>;
  [OperationEventKind.PostOperation]: OperationEvent<TArgs, TCustomContext, TBaseContext, TOperationContext>;
}

export const operationTypeMap = {
  [GraphQLOperationType.Mutation]: { CreateOne, DeleteOne, UpdateOne, UpsertOne },
  [GraphQLOperationType.Query]: { AssertOne, Count, FindMany, FindOne },
};

export type OperationTypeMap = typeof operationTypeMap;

export type OperationType = keyof OperationTypeMap;

export type OperationConstructorMap<TOperationType extends OperationType> = OperationTypeMap[TOperationType];

export type OperationId<TOperationType extends OperationType> = keyof OperationConstructorMap<TOperationType>;

export type OperationConstructor<TType extends OperationType, TId extends OperationId<TType>> = OperationConstructorMap<
  TType
>[TId] extends Class
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
      subscriptions?: Maybe<OperationTypeConfig<GraphQLOperationType.Subscription>>;
    };
