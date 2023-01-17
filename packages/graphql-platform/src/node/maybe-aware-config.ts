import type { ConnectorInterface } from '../connector-interface.js';
import type { Node } from '../node.js';

export type MaybeNodeAwareConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TConfig,
> = TConfig | ((node: Node<TRequestContext, TConnector>) => TConfig);

export const resolveMaybeNodeAwareConfig = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TConfig,
>(
  node: Node<TRequestContext, TConnector>,
  config: MaybeNodeAwareConfig<TRequestContext, TConnector, TConfig>,
): TConfig => (typeof config === 'function' ? (config as any)(node) : config);
