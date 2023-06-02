import type { Constructor } from 'type-fest';
import type { Node } from '../../node.js';
import { creationConstructors, type Creation } from './mutation/creation.js';
import { deletionConstructors, type Deletion } from './mutation/deletion.js';
import { updateConstructors, type Update } from './mutation/update.js';
import { UpsertMutation } from './mutation/upsert.js';

export * from './mutation/config.js';
export * from './mutation/context.js';
export * from './mutation/creation.js';
export * from './mutation/deletion.js';
export * from './mutation/interface.js';
export * from './mutation/update.js';

export type Mutation<TRequestContext extends object = any> =
  | Creation<TRequestContext>
  | Update<TRequestContext>
  | Deletion<TRequestContext>
  | UpsertMutation<TRequestContext>;

export const mutationConstructors = [
  ...creationConstructors,
  ...updateConstructors,
  ...deletionConstructors,
  UpsertMutation,
] satisfies Constructor<Mutation, [Node]>[];
