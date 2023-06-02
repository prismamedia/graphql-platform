import type * as graphql from 'graphql';
import type { OperationInterface } from './operation/interface.js';
import type { MutationsByKey } from './operation/mutation.js';
import type { MutationInterface } from './operation/mutation/interface.js';
import type { QueriesByKey } from './operation/query.js';
import type { SubscriptionsByKey } from './operation/subscription.js';

export * from './operation/api.js';
export * from './operation/context.js';
export * from './operation/error.js';
export * from './operation/interface.js';
export * from './operation/mutation.js';
export * from './operation/query.js';
export * from './operation/subscription.js';

export interface OperationsByNameByType<TRequestContext extends object = any> {
  readonly [graphql.OperationTypeNode.MUTATION]: ReadonlyMap<
    MutationInterface['name'],
    MutationInterface<TRequestContext>
  >;
  readonly [graphql.OperationTypeNode.QUERY]: ReadonlyMap<
    OperationInterface['name'],
    OperationInterface<TRequestContext>
  >;
  readonly [graphql.OperationTypeNode.SUBSCRIPTION]: ReadonlyMap<
    OperationInterface['name'],
    OperationInterface<TRequestContext>
  >;
}

export type OperationsByKeyByType<TRequestContext extends object = any> = {
  [graphql.OperationTypeNode.MUTATION]: MutationsByKey<TRequestContext>;
  [graphql.OperationTypeNode.QUERY]: QueriesByKey<TRequestContext>;
  [graphql.OperationTypeNode.SUBSCRIPTION]: SubscriptionsByKey<TRequestContext>;
};
