import type { MariaDBSubscription } from '../subscription';

export class MariaDBSubscriptionError extends Error {
  public constructor(
    public readonly subscription: MariaDBSubscription,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);

    this.name = new.target.name;
    Object.defineProperty(this, 'subscription', { enumerable: false });
  }
}
