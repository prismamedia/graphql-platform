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
    value: TValue,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    super(subscription, initiators);

    this.value = Object.freeze(value);
  }
}
