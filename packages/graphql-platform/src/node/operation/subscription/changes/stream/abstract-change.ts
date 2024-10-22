import type { NodeValue } from '../../../../../node.js';
import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TValue extends NodeValue = any,
  TRequestContext extends object = any,
> {
  public constructor(
    public readonly subscription: ChangesSubscriptionStream,
    public readonly value: Readonly<TValue>,
    public readonly initiators: ReadonlySet<TRequestContext>,
  ) {}
}
