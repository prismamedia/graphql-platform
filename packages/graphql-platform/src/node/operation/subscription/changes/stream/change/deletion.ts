import assert from 'node:assert';
import type { NodeValue } from '../../../../../../node.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionDeletion<
  TValue extends NodeValue = any,
> extends AbstractChangesSubscriptionChange<TValue> {
  public constructor(
    subscription: ChangesSubscriptionStream<any, TValue>,
    value: Readonly<any>,
  ) {
    assert(subscription.onDeletionSelection);

    super(subscription, subscription.onDeletionSelection.pickValue(value));
  }
}
