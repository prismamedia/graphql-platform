import type { UniqueConstraintValue } from '../../definition.js';
import type { NodeSelectedValue } from '../../statement.js';
import type { NodeSubscription } from '../../subscription.js';
import { AbstractNodeSubscriptionChange } from '../abstract-change.js';

export class NodeSubscriptionUpsert<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> extends AbstractNodeSubscriptionChange<TId, TValue, TRequestContext> {
  public override readonly kind = 'upsert';

  public readonly value: Readonly<TValue>;

  public constructor(
    subscription: NodeSubscription<TId, TValue, TRequestContext>,
    value: unknown,
    requestContexts?: ReadonlyArray<TRequestContext>,
  ) {
    super(subscription, value, requestContexts);

    this.value = Object.freeze(
      subscription.selection.parseValue(value) as TValue,
    );
  }
}
