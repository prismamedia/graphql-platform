import type { Constructor } from 'type-fest';
import type { Node } from '../../../node.js';
import type { AbstractUpdate } from './abstract-update.js';
import { UpdateManyMutation } from './update/update-many.js';
import { UpdateOneIfExistsMutation } from './update/update-one-if-exists.js';
import { UpdateOneMutation } from './update/update-one.js';

export * from './abstract-update.js';
export * from './update/update-many.js';
export * from './update/update-one-if-exists.js';
export * from './update/update-one.js';

export type Update<TRequestContext extends object = any> =
  | UpdateManyMutation<TRequestContext>
  | UpdateOneMutation<TRequestContext>
  | UpdateOneIfExistsMutation<TRequestContext>
  | AbstractUpdate<TRequestContext>;

export const updateConstructors = [
  UpdateManyMutation,
  UpdateOneMutation,
  UpdateOneIfExistsMutation,
] satisfies Constructor<Update, [Node]>[];
