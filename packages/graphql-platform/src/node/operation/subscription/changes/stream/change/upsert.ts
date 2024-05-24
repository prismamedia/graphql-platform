import type { NodeSelectedValue } from '../../../../../statement.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionUpsert<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> extends AbstractChangesSubscriptionChange<TValue, TRequestContext> {
  public constructor(
    subscription: ChangesSubscriptionStream,
    value: Readonly<TValue>,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    super(
      subscription,
      subscription.onUpsertSelection.pickValue(value),
      initiators,
    );
  }
}
