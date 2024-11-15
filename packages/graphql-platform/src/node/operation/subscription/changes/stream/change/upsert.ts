import type { NodeSelectedValue } from '../../../../../statement.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionUpsert<
  TValue extends NodeSelectedValue = any,
> extends AbstractChangesSubscriptionChange<TValue> {
  public constructor(
    subscription: ChangesSubscriptionStream<TValue, any>,
    value: Readonly<any>,
  ) {
    super(subscription, subscription.onUpsertSelection.pickValue(value));
  }
}
