import type { ConnectorInterface } from '../../../connector-interface.js';
import { CreateOneMutation } from './creation/create-one.js';
import { CreateSomeMutation } from './creation/create-some.js';

export * from './creation/create-one.js';
export * from './creation/create-some.js';

export const creationConstructorsByKey = {
  'create-one': CreateOneMutation,
  'create-some': CreateSomeMutation,
} as const;

export type CreationsByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  'create-one': CreateOneMutation<TRequestContext, TConnector>;
  'create-some': CreateSomeMutation<TRequestContext, TConnector>;
};
