import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../node.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionDeletion<
  TValue extends NodeValue = any,
  TRequestContext extends object = any,
> extends AbstractChangesSubscriptionChange<TValue, TRequestContext> {
  public constructor(
    subscription: ChangesSubscriptionStream<any, TValue, TRequestContext>,
    value: Readonly<any>,
    initiators: ReadonlySet<TRequestContext>,
  ) {
    assert(subscription.onDeletionSelection);

    super(
      subscription,
      subscription.onDeletionSelection.pickValue(value),
      initiators,
    );
  }
}
