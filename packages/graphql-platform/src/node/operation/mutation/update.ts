import type { AbstractUpdate } from './abstract-update.js';
import { UpdateManyMutation } from './update/update-many.js';
import { UpdateOneIfExistsMutation } from './update/update-one-if-exists.js';
import { UpdateOneMutation } from './update/update-one.js';

export * from './update/update-many.js';
export * from './update/update-one-if-exists.js';
export * from './update/update-one.js';

export const updateConstructorsByKey = {
  'update-many': UpdateManyMutation,
  'update-one': UpdateOneMutation,
  'update-one-if-exists': UpdateOneIfExistsMutation,
} satisfies Record<string, typeof AbstractUpdate<any, any, any>>;

export type UpdatesByKey<TRequestContext extends object> = {
  'update-many': UpdateManyMutation<TRequestContext>;
  'update-one': UpdateOneMutation<TRequestContext>;
  'update-one-if-exists': UpdateOneIfExistsMutation<TRequestContext>;
};
