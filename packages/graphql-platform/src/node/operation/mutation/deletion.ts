import type { Constructor } from 'type-fest';
import type { Node } from '../../../node.js';
import { DeleteManyMutation } from './deletion/delete-many.js';
import { DeleteOneIfExistsMutation } from './deletion/delete-one-if-exists.js';
import { DeleteOneMutation } from './deletion/delete-one.js';

export * from './deletion/delete-many.js';
export * from './deletion/delete-one-if-exists.js';
export * from './deletion/delete-one.js';

export type Deletion<TRequestContext extends object = any> =
  | DeleteManyMutation<TRequestContext>
  | DeleteOneMutation<TRequestContext>
  | DeleteOneIfExistsMutation<TRequestContext>;

export const deletionConstructors = [
  DeleteManyMutation,
  DeleteOneMutation,
  DeleteOneIfExistsMutation,
] satisfies Constructor<Deletion, [Node]>[];
