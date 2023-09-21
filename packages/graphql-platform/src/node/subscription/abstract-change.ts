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
      subscription.uniqueConstraint.componentSet.size === 1
        ? subscription.uniqueConstraint.leafSet.values().next().value
        : undefined;

    this.stringifiedId = pureIdentifierLeaf
      ? pureIdentifierLeaf.stringify(id[pureIdentifierLeaf.name])
      : subscription.uniqueConstraint.stringify(id);
  }
}
