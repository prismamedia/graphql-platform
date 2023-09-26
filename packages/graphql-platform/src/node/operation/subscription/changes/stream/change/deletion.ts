import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../node.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionDeletion<
  TValue extends NodeValue = any,
  TRequestContext extends object = any,
> extends AbstractChangesSubscriptionChange<TRequestContext> {
  public readonly value: Readonly<TValue>;

  public constructor(
    subscription: ChangesSubscriptionStream<any, TValue, TRequestContext>,
    value: unknown,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    assert(subscription.onDeletionSelection);

    super(subscription, initiators);

    this.value = Object.freeze(
      subscription.onDeletionSelection.parseValue(value),
    );
  }
}
