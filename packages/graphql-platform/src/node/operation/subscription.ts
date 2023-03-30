import type { Simplify } from 'type-fest';
import type { AbstractSubscription } from './abstract-subscription.js';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export const subscriptionConstructorsByKey = {
  changes: ChangesSubscription,
} satisfies Record<string, typeof AbstractSubscription<any, any, any>>;

export type SubscriptionsByKey<TRequestContext extends object> = {
  changes: ChangesSubscription<TRequestContext>;
};

export type SubscriptionKey = Simplify<keyof SubscriptionsByKey<any>>;
