import type { ConnectorInterface } from '../../../connector-interface.js';
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
} as const;

export type UpdatesByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  'update-many': UpdateManyMutation<TRequestContext, TConnector>;
  'update-one': UpdateOneMutation<TRequestContext, TConnector>;
  'update-one-if-exists': UpdateOneIfExistsMutation<
    TRequestContext,
    TConnector
  >;
};
