import assert from 'node:assert';
import type { NodeValue } from '../../../../../../node.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionDeletion<
  TRequestContext extends object = any,
  TValue extends NodeValue = any,
> extends AbstractChangesSubscriptionChange<TRequestContext> {
  public readonly value: Readonly<TValue>;

  public constructor(
    subscription: ChangesSubscriptionStream<TRequestContext, any, TValue>,
    initiator: TRequestContext,
    value: Readonly<any>,
  ) {
    assert(subscription.onDeletionSelection);
    super(subscription, initiator);

    this.value = subscription.onDeletionSelection.pickValue(value);
  }
}
