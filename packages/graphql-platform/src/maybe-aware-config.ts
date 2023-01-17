import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';

export type MaybeGPAwareConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TConfig,
> = TConfig | ((gp: GraphQLPlatform<TRequestContext, TConnector>) => TConfig);

export const resolveMaybeGPAwareConfig = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TConfig,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
  config?: MaybeGPAwareConfig<TRequestContext, TConnector, TConfig>,
): TConfig | undefined =>
  config
    ? ((typeof config === 'function' ? (config as any)(gp) : config) as TConfig)
    : undefined;
