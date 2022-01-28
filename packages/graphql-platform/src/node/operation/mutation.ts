import type { Simplify } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
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
} as const;

export type MutationsByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = Simplify<
  CreationsByKey<TRequestContext, TConnector> &
    DeletionsByKey<TRequestContext, TConnector> &
    UpdatesByKey<TRequestContext, TConnector> & {
      upsert: UpsertMutation<TRequestContext, TConnector>;
    }
>;

export type MutationKey = Simplify<keyof MutationsByKey<any, any>>;
