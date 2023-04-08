import type { ConnectorInterface } from '../../connector-interface.js';
import {
  MultipleReverseEdge,
  type MultipleReverseEdgeConfig,
} from './reverse-edge/multiple.js';
import {
  UniqueReverseEdge,
  type UniqueReverseEdgeConfig,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeConfig =
  | UniqueReverseEdgeConfig
  | MultipleReverseEdgeConfig;

export type ReverseEdge<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> =
  | UniqueReverseEdge<TRequestContext, TConnector, TContainer>
  | MultipleReverseEdge<TRequestContext, TConnector, TContainer>;

export const isReverseEdge = <
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
>(
  maybeReverseEdge: unknown,
): maybeReverseEdge is ReverseEdge<TRequestContext, TConnector, TContainer> =>
  maybeReverseEdge instanceof UniqueReverseEdge ||
  maybeReverseEdge instanceof MultipleReverseEdge;
