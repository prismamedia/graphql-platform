import type { ConnectorInterface } from '../../connector-interface.js';
import type {
  MultipleReverseEdge,
  MultipleReverseEdgeConfig,
} from './reverse-edge/multiple.js';
import type {
  UniqueReverseEdge,
  UniqueReverseEdgeConfig,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeConfig =
  | UniqueReverseEdgeConfig
  | MultipleReverseEdgeConfig;

export type ReverseEdge<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TServiceContainer extends object = any,
> =
  | UniqueReverseEdge<TRequestContext, TConnector, TServiceContainer>
  | MultipleReverseEdge<TRequestContext, TConnector, TServiceContainer>;
