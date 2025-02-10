import type { NodeSelectedValue } from '../../../../../statement.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionUpsert<
  TRequestContext extends object = any,
  TValue extends NodeSelectedValue = any,
> extends AbstractChangesSubscriptionChange<TRequestContext> {
  public readonly value: Readonly<TValue>;

  public constructor(
    subscription: ChangesSubscriptionStream<TRequestContext, TValue, any>,
    initiator: TRequestContext,
    value: Readonly<any>,
  ) {
    super(subscription, initiator);

    this.value = subscription.onUpsertSelection.pickValue(value);
  }
}
