import type { Simplify } from 'type-fest';
import type { AbstractMutation } from './abstract-mutation.js';
import {
  creationConstructorsByKey,
  type CreationsByKey,
} from './mutation/creation.js';
import {
  deletionConstructorsByKey,
  type DeletionsByKey,
} from './mutation/deletion.js';
import {
  updateConstructorsByKey,
  type UpdatesByKey,
} from './mutation/update.js';
import { UpsertMutation } from './mutation/upsert.js';

export * from './mutation/config.js';
export * from './mutation/context.js';
export * from './mutation/creation.js';
export * from './mutation/deletion.js';
export * from './mutation/interface.js';
export * from './mutation/update.js';

export const mutationConstructorsByKey = {
  ...creationConstructorsByKey,
  ...deletionConstructorsByKey,
  ...updateConstructorsByKey,
  upsert: UpsertMutation,
} satisfies Record<string, typeof AbstractMutation<any, any, any>>;

export type MutationsByKey<TRequestContext extends object> = Simplify<
  CreationsByKey<TRequestContext> &
    UpdatesByKey<TRequestContext> &
    DeletionsByKey<TRequestContext> & {
      upsert: UpsertMutation<TRequestContext>;
    }
>;

export type MutationKey = Simplify<keyof MutationsByKey<any>>;
