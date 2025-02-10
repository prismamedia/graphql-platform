import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TRequestContext extends object = any,
> {
  public constructor(
    public readonly subscription: ChangesSubscriptionStream<TRequestContext>,
    public readonly initiator: TRequestContext,
  ) {}
}
