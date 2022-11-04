import type { Simplify } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import { ChangesSubscription } from './subscription/changes.js';

export * from './subscription/changes.js';

export const nodeSubscriptionConstructorsByKey = {
  changes: ChangesSubscription,
} as const;

export type NodeSubscriptionsByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  changes: ChangesSubscription<TRequestContext, TConnector>;
};

export type NodeSubscriptionKey = Simplify<
  keyof NodeSubscriptionsByKey<any, any>
>;
