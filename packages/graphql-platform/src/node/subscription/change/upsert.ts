import type { UniqueConstraintValue } from '../../definition.js';
import type { NodeSelectedValue } from '../../statement.js';
import type { NodeSubscription } from '../../subscription.js';
import { AbstractNodeSubscriptionChange } from '../abstract-change.js';

export class NodeSubscriptionUpsert<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> extends AbstractNodeSubscriptionChange<TId, TRequestContext> {
  public override readonly kind = 'upsert';

  public constructor(
    subscription: NodeSubscription,
    id: TId,
    public readonly value: Readonly<TValue>,
    requestContexts?: ReadonlyArray<TRequestContext>,
  ) {
    super(subscription, id, requestContexts);

    Object.freeze(value);
  }
}
