import type { Constructor } from 'type-fest';
import type { Node } from '../../node.js';
import { ChangesSubscription } from './subscription/changes.js';
import { ScrollSubscription } from './subscription/scroll.js';

export * from './abstract-subscription.js';
export type { SubscriptionConfig } from './abstract-subscription.js';
export * from './subscription/changes.js';
export * from './subscription/scroll.js';

export type Subscription<TRequestContext extends object = any> =
  | ChangesSubscription<TRequestContext>
  | ScrollSubscription<TRequestContext>;

export const subscriptionConstructors = [
  ChangesSubscription,
  ScrollSubscription,
] satisfies Constructor<Subscription, [Node]>[];
