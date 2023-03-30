import type { AbstractCreation } from './abstract-creation.js';
import { CreateOneIfNotExistsMutation } from './creation/create-one-if-not-exists.js';
import { CreateOneMutation } from './creation/create-one.js';
import { CreateSomeMutation } from './creation/create-some.js';

export * from './creation/create-one-if-not-exists.js';
export * from './creation/create-one.js';
export * from './creation/create-some.js';

export const creationConstructorsByKey = {
  'create-one': CreateOneMutation,
  'create-one-if-not-exists': CreateOneIfNotExistsMutation,
  'create-some': CreateSomeMutation,
} satisfies Record<string, typeof AbstractCreation<any, any, any>>;

export type CreationsByKey<TRequestContext extends object> = {
  'create-one': CreateOneMutation<TRequestContext>;
  'create-one-if-not-exists': CreateOneIfNotExistsMutation<TRequestContext>;
  'create-some': CreateSomeMutation<TRequestContext>;
};
