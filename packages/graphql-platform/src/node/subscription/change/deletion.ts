import type { UniqueConstraintValue } from '../../definition.js';
import type { NodeSelectedValue } from '../../statement.js';
import { AbstractNodeSubscriptionChange } from '../abstract-change.js';

export class NodeSubscriptionDeletion<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> extends AbstractNodeSubscriptionChange<TId, TValue, TRequestContext> {
  public override readonly kind = 'deletion';
}
