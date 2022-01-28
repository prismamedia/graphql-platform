import type { Simplify } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import { CountQuery } from './query/count.js';
import { ExistsQuery } from './query/exists.js';
import { FindManyQuery } from './query/find-many.js';
import { GetOneIfExistsQuery } from './query/get-one-if-exists.js';
import { GetOneQuery } from './query/get-one.js';
import { GetSomeInOrderIfExistsQuery } from './query/get-some-in-order-if-exists.js';
import { GetSomeInOrderQuery } from './query/get-some-in-order.js';

export * from './query/count.js';
export * from './query/exists.js';
export * from './query/find-many.js';
export * from './query/get-one-if-exists.js';
export * from './query/get-one.js';
export * from './query/get-some-in-order-if-exists.js';
export * from './query/get-some-in-order.js';

export const queryConstructorsByKey = {
  count: CountQuery,
  exists: ExistsQuery,
  'find-many': FindManyQuery,
  'get-one': GetOneQuery,
  'get-one-if-exists': GetOneIfExistsQuery,
  'get-some-in-order': GetSomeInOrderQuery,
  'get-some-in-order-if-exists': GetSomeInOrderIfExistsQuery,
} as const;

export type QueriesByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  count: CountQuery<TRequestContext, TConnector>;
  exists: ExistsQuery<TRequestContext, TConnector>;
  'find-many': FindManyQuery<TRequestContext, TConnector>;
  'get-one': GetOneQuery<TRequestContext, TConnector>;
  'get-one-if-exists': GetOneIfExistsQuery<TRequestContext, TConnector>;
  'get-some-in-order': GetSomeInOrderQuery<TRequestContext, TConnector>;
  'get-some-in-order-if-exists': GetSomeInOrderIfExistsQuery<
    TRequestContext,
    TConnector
  >;
};

export type QueryKey = Simplify<keyof QueriesByKey<any, any>>;
