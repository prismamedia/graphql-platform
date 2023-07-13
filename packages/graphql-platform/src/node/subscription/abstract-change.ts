import type { UniqueConstraintValue } from '../definition.js';
import type { NodeSubscription } from '../subscription.js';

export abstract class AbstractNodeSubscriptionChange<
  TId extends UniqueConstraintValue,
  TRequestContext extends object,
> {
  public abstract readonly kind: string;

  public readonly stringifiedId: string;

  public constructor(
    public readonly subscription: NodeSubscription,
    public readonly id: Readonly<TId>,
    public readonly requestContexts?: ReadonlyArray<TRequestContext>,
  ) {
    Object.freeze(id);

    const pureIdentifierLeaf =
      subscription.id.componentSet.size === 1
        ? subscription.id.leafSet.values().next().value
        : undefined;

    this.stringifiedId = pureIdentifierLeaf
      ? pureIdentifierLeaf.stringify(id[pureIdentifierLeaf.name])
      : subscription.id.stringify(id);
  }
}
