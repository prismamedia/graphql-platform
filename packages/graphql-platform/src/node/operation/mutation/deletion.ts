import type { AbstractDeletion } from './abstract-deletion.js';
import { DeleteManyMutation } from './deletion/delete-many.js';
import { DeleteOneIfExistsMutation } from './deletion/delete-one-if-exists.js';
import { DeleteOneMutation } from './deletion/delete-one.js';

export * from './deletion/delete-many.js';
export * from './deletion/delete-one-if-exists.js';
export * from './deletion/delete-one.js';

export const deletionConstructorsByKey = {
  'delete-many': DeleteManyMutation,
  'delete-one': DeleteOneMutation,
  'delete-one-if-exists': DeleteOneIfExistsMutation,
} satisfies Record<string, typeof AbstractDeletion<any, any, any>>;

export type DeletionsByKey<TRequestContext extends object> = {
  'delete-many': DeleteManyMutation<TRequestContext>;
  'delete-one': DeleteOneMutation<TRequestContext>;
  'delete-one-if-exists': DeleteOneIfExistsMutation<TRequestContext>;
};
