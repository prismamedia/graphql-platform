import type { UniqueConstraintValue } from '../../definition.js';
import { AbstractNodeSubscriptionChange } from '../abstract-change.js';

export class NodeSubscriptionDeletion<
  TId extends UniqueConstraintValue = any,
  TRequestContext extends object = any,
> extends AbstractNodeSubscriptionChange<TId, TRequestContext> {
  public override readonly kind = 'deletion';
}
