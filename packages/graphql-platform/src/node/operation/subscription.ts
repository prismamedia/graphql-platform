import type { Constructor } from 'type-fest';
import type { Node } from '../../node.js';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export type SubscriptionsByKey<TRequestContext extends object = any> = {
  changes: ChangesSubscription<TRequestContext>;
};

export const subscriptionConstructorsByKey = {
  changes: ChangesSubscription,
} satisfies {
  [TKey in keyof SubscriptionsByKey]: Constructor<
    SubscriptionsByKey[TKey],
    [Node]
  >;
};
