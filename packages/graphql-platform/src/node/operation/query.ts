import type { Simplify } from 'type-fest';
import type { AbstractQuery } from './abstract-query.js';
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
} satisfies Record<string, typeof AbstractQuery<any, any, any>>;

export type QueriesByKey<TRequestContext extends object> = {
  count: CountQuery<TRequestContext>;
  exists: ExistsQuery<TRequestContext>;
  'find-many': FindManyQuery<TRequestContext>;
  'get-one': GetOneQuery<TRequestContext>;
  'get-one-if-exists': GetOneIfExistsQuery<TRequestContext>;
  'get-some-in-order': GetSomeInOrderQuery<TRequestContext>;
  'get-some-in-order-if-exists': GetSomeInOrderIfExistsQuery<TRequestContext>;
};

export type QueryKey = Simplify<keyof QueriesByKey<any>>;
