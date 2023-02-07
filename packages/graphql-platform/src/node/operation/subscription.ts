import type { Simplify } from 'type-fest';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export const subscriptionConstructorsByKey = {
  changes: ChangesSubscription,
} as const;

export type SubscriptionsByKey<TRequestContext extends object> = {
  changes: ChangesSubscription<TRequestContext>;
};

export type SubscriptionKey = Simplify<keyof SubscriptionsByKey<any>>;
