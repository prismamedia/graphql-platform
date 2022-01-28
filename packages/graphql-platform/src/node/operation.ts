import type * as graphql from 'graphql';
import type { ConnectorInterface } from '../connector-interface.js';
import type { OperationInterface } from './operation/interface.js';
import type { MutationInterface } from './operation/mutation/interface.js';

export * from './operation/api.js';
export * from './operation/context.js';
export * from './operation/error.js';
export * from './operation/interface.js';
export * from './operation/mutation.js';
export * from './operation/query.js';
export * from './operation/subscription.js';

export interface OperationsByNameByType<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  readonly [graphql.OperationTypeNode.MUTATION]: ReadonlyMap<
    MutationInterface['name'],
    MutationInterface<TRequestContext, TConnector>
  >;
  readonly [graphql.OperationTypeNode.QUERY]: ReadonlyMap<
    OperationInterface['name'],
    OperationInterface<TRequestContext, TConnector>
  >;
  readonly [graphql.OperationTypeNode.SUBSCRIPTION]: ReadonlyMap<
    OperationInterface['name'],
    OperationInterface<TRequestContext, TConnector>
  >;
}
