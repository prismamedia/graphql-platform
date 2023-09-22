import type { UniqueConstraintValue } from '../definition.js';
import type { NodeSelectedValue } from '../statement.js';
import type { NodeSubscription } from '../subscription.js';

export abstract class AbstractNodeSubscriptionChange<
  TId extends UniqueConstraintValue = any,
  TValue extends NodeSelectedValue & TId = any,
  TRequestContext extends object = any,
> {
  public abstract readonly kind: string;

  public readonly id: Readonly<TId>;
  public readonly stringifiedId: string;

  public constructor(
    public readonly subscription: NodeSubscription<
      TId,
      TValue,
      TRequestContext
    >,
    id: unknown,
    public readonly requestContexts?: ReadonlyArray<TRequestContext>,
  ) {
    this.id = Object.freeze(
      subscription.uniqueConstraint.parseValue(id) as TId,
    );

    const pureIdentifierLeaf =
      subscription.uniqueConstraint.componentSet.size === 1
        ? subscription.uniqueConstraint.leafSet.values().next().value
        : undefined;

    this.stringifiedId = pureIdentifierLeaf
      ? pureIdentifierLeaf.stringify(this.id[pureIdentifierLeaf.name])
      : subscription.uniqueConstraint.stringify(this.id);
  }
}
