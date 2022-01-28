import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';

export type MaybeNodeAwareConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  T,
> = T | ((node: Node<TRequestContext, TConnector>) => T);

export const resolveMaybeNodeAwareConfig = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  T,
>(
  node: Node<TRequestContext, TConnector>,
  config: MaybeNodeAwareConfig<TRequestContext, TConnector, T>,
): T => (typeof config === 'function' ? (config as any)(node) : config);
