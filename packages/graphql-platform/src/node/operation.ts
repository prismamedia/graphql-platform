import { OperationTypeNode } from 'graphql';
import type { Constructor } from 'type-fest';
import type { Node } from '../node.js';
import { mutationConstructors, type Mutation } from './operation/mutation.js';
import { queryConstructors, type Query } from './operation/query.js';
import {
  subscriptionConstructors,
  type Subscription,
} from './operation/subscription.js';

export * from './operation/api.js';
export * from './operation/context.js';
export * from './operation/dependency-graph.js';
export * from './operation/error.js';
export * from './operation/interface.js';
export * from './operation/mutation.js';
export * from './operation/query.js';
export * from './operation/subscription.js';

export type OperationByType<TRequestContext extends object = any> = {
  [OperationTypeNode.MUTATION]: Mutation<TRequestContext>;
  [OperationTypeNode.QUERY]: Query<TRequestContext>;
  [OperationTypeNode.SUBSCRIPTION]: Subscription<TRequestContext>;
};

export type OperationType = keyof OperationByType;

export type Operation<TRequestContext extends object = any> =
  OperationByType<TRequestContext>[OperationType];

export const operationConstructorsByType = {
  [OperationTypeNode.MUTATION]: mutationConstructors,
  [OperationTypeNode.QUERY]: queryConstructors,
  [OperationTypeNode.SUBSCRIPTION]: subscriptionConstructors,
} satisfies {
  [TType in OperationType]: Constructor<OperationByType[TType], [Node]>[];
};

export type OperationsByType<TRequestContext extends object = any> = {
  [TType in OperationType]: OperationByType<TRequestContext>[TType][];
};
