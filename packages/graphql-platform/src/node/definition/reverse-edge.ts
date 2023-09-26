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

export type ReverseEdge<TConnector extends ConnectorInterface = any> =
  | UniqueReverseEdge<TConnector>
  | MultipleReverseEdge<TConnector>;

export const isReverseEdge = (
  maybeReverseEdge: unknown,
): maybeReverseEdge is ReverseEdge =>
  maybeReverseEdge instanceof UniqueReverseEdge ||
  maybeReverseEdge instanceof MultipleReverseEdge;
