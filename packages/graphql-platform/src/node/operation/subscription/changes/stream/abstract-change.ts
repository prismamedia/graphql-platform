import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TRequestContext extends object = any,
> {
  public readonly initiators: ReadonlySet<TRequestContext>;

  public constructor(
    public readonly subscription: ChangesSubscriptionStream<TRequestContext>,
    initiators?: ReadonlySet<TRequestContext> | TRequestContext,
  ) {
    this.initiators =
      initiators instanceof Set ? initiators : new Set([initiators]);
  }
}
