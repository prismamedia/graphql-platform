import type { Simplify } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import { ChangeSubscription } from './subscription/change.js';

export * from './subscription/change.js';

export const nodeSubscriptionConstructorsByKey = {
  change: ChangeSubscription,
} as const;

export type NodeSubscriptionsByKey<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  change: ChangeSubscription<TRequestContext, TConnector>;
};

export type NodeSubscriptionKey = Simplify<
  keyof NodeSubscriptionsByKey<any, any>
>;
