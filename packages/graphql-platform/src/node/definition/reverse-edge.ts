import type { ConnectorInterface } from '../../connector-interface.js';
import type {
  ReverseEdgeMultiple,
  ReverseEdgeMultipleConfig,
} from './reverse-edge/multiple.js';
import type {
  ReverseEdgeUnique,
  ReverseEdgeUniqueConfig,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> =
  | ReverseEdgeUniqueConfig<TRequestContext, TConnector>
  | ReverseEdgeMultipleConfig<TRequestContext, TConnector>;

export type ReverseEdge<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | ReverseEdgeUnique<TRequestContext, TConnector>
  | ReverseEdgeMultiple<TRequestContext, TConnector>;
