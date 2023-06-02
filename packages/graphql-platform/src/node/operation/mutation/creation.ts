import type { Constructor } from 'type-fest';
import type { Node } from '../../../node.js';
import { CreateOneIfNotExistsMutation } from './creation/create-one-if-not-exists.js';
import { CreateOneMutation } from './creation/create-one.js';
import { CreateSomeMutation } from './creation/create-some.js';

export * from './creation/create-one-if-not-exists.js';
export * from './creation/create-one.js';
export * from './creation/create-some.js';

export type Creation<TRequestContext extends object = any> =
  | CreateOneMutation<TRequestContext>
  | CreateOneIfNotExistsMutation<TRequestContext>
  | CreateSomeMutation<TRequestContext>;

export const creationConstructors = [
  CreateOneMutation,
  CreateOneIfNotExistsMutation,
  CreateSomeMutation,
] satisfies Constructor<Creation, [Node]>[];
