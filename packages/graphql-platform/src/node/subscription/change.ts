import type { UniqueConstraintValue } from '../definition.js';
import type { NodeSelectedValue } from '../statement.js';
import { NodeSubscriptionDeletion } from './change/deletion.js';
import { NodeSubscriptionUpsert } from './change/upsert.js';

export * from './change/deletion.js';
export * from './change/upsert.js';

export type NodeSubscriptionChange<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> =
  | NodeSubscriptionDeletion<TId, TRequestContext>
  | NodeSubscriptionUpsert<TId, TValue, TRequestContext>;

export const isNodeSubscriptionChange = <
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
>(
  maybeChange: unknown,
): maybeChange is NodeSubscriptionChange<TId, TValue, TRequestContext> =>
  maybeChange instanceof NodeSubscriptionDeletion ||
  maybeChange instanceof NodeSubscriptionUpsert;
