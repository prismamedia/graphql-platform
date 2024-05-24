import type { NodeValue } from '../../../../../node.js';
import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TValue extends NodeValue = any,
  TRequestContext extends object = any,
> {
  public readonly value: Readonly<TValue>;
  public readonly initiators: ReadonlyArray<TRequestContext>;

  public constructor(
    public readonly subscription: ChangesSubscriptionStream,
    value: Readonly<TValue>,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    this.value = Object.freeze(value);
    this.initiators = Object.freeze(initiators);
  }
}
