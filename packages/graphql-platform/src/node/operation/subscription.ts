import type { Simplify } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export const subscriptionConstructorsByKey = {
  changes: ChangesSubscription,
} as const;

export type SubscriptionsByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  changes: ChangesSubscription<TRequestContext, TConnector>;
};

export type SubscriptionKey = Simplify<keyof SubscriptionsByKey<any, any>>;
