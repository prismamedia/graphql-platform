import type { NodeSelectedValue } from '../../../../../statement.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionUpsert<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> extends AbstractChangesSubscriptionChange<TRequestContext> {
  public readonly value: Readonly<TValue>;

  public constructor(
    subscription: ChangesSubscriptionStream<TValue, any, TRequestContext>,
    value: unknown,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    super(subscription, initiators);

    this.value = Object.freeze(
      subscription.onUpsertSelection.parseValue(value),
    );
  }
}
