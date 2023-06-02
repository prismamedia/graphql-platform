import type { Constructor } from 'type-fest';
import type { Node } from '../../node.js';
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

export type Query<TRequestContext extends object = any> =
  | CountQuery<TRequestContext>
  | ExistsQuery<TRequestContext>
  | FindManyQuery<TRequestContext>
  | GetOneQuery<TRequestContext>
  | GetOneIfExistsQuery<TRequestContext>
  | GetSomeInOrderQuery<TRequestContext>
  | GetSomeInOrderIfExistsQuery<TRequestContext>;

export const queryConstructors = [
  CountQuery,
  ExistsQuery,
  FindManyQuery,
  GetOneQuery,
  GetOneIfExistsQuery,
  GetSomeInOrderQuery,
  GetSomeInOrderIfExistsQuery,
] satisfies Constructor<Query, [Node]>[];
