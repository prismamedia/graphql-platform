import type { NodeSelectedValue } from '../../../../../statement.js';
import type { ChangesSubscriptionStream } from '../../stream.js';
import { AbstractChangesSubscriptionChange } from '../abstract-change.js';

export class ChangesSubscriptionUpsert<
  TValue extends NodeSelectedValue = any,
  TRequestContext extends object = any,
> extends AbstractChangesSubscriptionChange<TValue, TRequestContext> {
  public constructor(
    subscription: ChangesSubscriptionStream<TValue, any, TRequestContext>,
    value: Readonly<any>,
    initiators: ReadonlySet<TRequestContext>,
  ) {
    super(
      subscription,
      subscription.onUpsertSelection.pickValue(value),
      initiators,
    );
  }
}
