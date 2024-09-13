import type { Constructor } from 'type-fest';
import type { Node } from '../../../node.js';
import type { AbstractDeletion } from './abstract-deletion.js';
import { DeleteManyMutation } from './deletion/delete-many.js';
import { DeleteOneIfExistsMutation } from './deletion/delete-one-if-exists.js';
import { DeleteOneMutation } from './deletion/delete-one.js';
import { DeleteSomeInOrderIfExistsMutation } from './deletion/delete-some-in-order-if-exists.js';
import { DeleteSomeInOrderMutation } from './deletion/delete-some-in-order.js';

export * from './abstract-deletion.js';
export * from './deletion/delete-many.js';
export * from './deletion/delete-one-if-exists.js';
export * from './deletion/delete-one.js';
export * from './deletion/delete-some-in-order-if-exists.js';
export * from './deletion/delete-some-in-order.js';

export type Deletion<TRequestContext extends object = any> =
  | DeleteManyMutation<TRequestContext>
  | DeleteOneIfExistsMutation<TRequestContext>
  | DeleteOneMutation<TRequestContext>
  | DeleteSomeInOrderIfExistsMutation<TRequestContext>
  | DeleteSomeInOrderMutation<TRequestContext>
  | AbstractDeletion<TRequestContext>;

export const deletionConstructors = [
  DeleteManyMutation,
  DeleteOneIfExistsMutation,
  DeleteOneMutation,
  DeleteSomeInOrderIfExistsMutation,
  DeleteSomeInOrderMutation,
] satisfies Constructor<Deletion, [Node]>[];
