import type { NodeValue } from '../../../../../node.js';
import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TValue extends NodeValue = any,
> {
  public constructor(
    public readonly subscription: ChangesSubscriptionStream,
    public readonly value: Readonly<TValue>,
  ) {}
}
