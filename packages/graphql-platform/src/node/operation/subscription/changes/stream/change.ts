import type { NodeValue } from '../../../../../node.js';
import type { NodeSelectedValue } from '../../../../statement.js';
import type { ChangesSubscriptionDeletion } from './change/deletion.js';
import type { ChangesSubscriptionUpsert } from './change/upsert.js';

export * from './change/deletion.js';
export * from './change/upsert.js';

export type ChangesSubscriptionChange<
  TRequestContext extends object = any,
  TUpsert extends NodeSelectedValue = any,
  TDeletion extends NodeValue = any,
> =
  | ChangesSubscriptionUpsert<TRequestContext, TUpsert>
  | ChangesSubscriptionDeletion<TRequestContext, TDeletion>;
