import {
  Class,
  GraphQLFieldConfig,
  GraphQLOperationType,
  GraphQLSelectionNode,
  Maybe,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../graphql-platform';
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

export type PostHook = () => Promise<void>;

export interface OperationContext extends POJO {
  postHooks: PostHook[];
}

export type OperationResolverParams<
  TArgs extends POJO = POJO,
  TContext extends BaseContext = BaseContext,
  TOperationContext extends OperationContext = any
> = Readonly<{
  args: TArgs;
  context: TContext;
  selectionNode: GraphQLSelectionNode<any>;
  operationContext?: TOperationContext;
}>;

export interface Operation {
  type: GraphQLOperationType;
  id: string;
  resource: Resource;
  name: string;
  isPublic(): boolean;
  getGraphQLFieldConfig(): GraphQLFieldConfig;
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
