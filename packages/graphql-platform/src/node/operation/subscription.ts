import type { Constructor } from 'type-fest';
import type { Node } from '../../node.js';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export type Subscription<TRequestContext extends object = any> =
  ChangesSubscription<TRequestContext>;

export const subscriptionConstructors = [
  ChangesSubscription,
] satisfies Constructor<Subscription, [Node]>[];
