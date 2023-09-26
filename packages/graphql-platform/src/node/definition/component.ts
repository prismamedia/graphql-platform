import type { ConnectorInterface } from '../../connector-interface.js';
import {
  Edge,
  type EdgeConfig,
  type ReferenceValue,
} from './component/edge.js';
import { Leaf, type LeafConfig, type LeafValue } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentConfig<TConnector extends ConnectorInterface = any> =
  | LeafConfig<TConnector>
  | EdgeConfig<TConnector>;

export type Component<TConnector extends ConnectorInterface = any> =
  | Leaf<TConnector>
  | Edge<TConnector>;

export const isComponent = (
  maybeComponent: unknown,
): maybeComponent is Component =>
  maybeComponent instanceof Leaf || maybeComponent instanceof Edge;

export type ComponentValue = LeafValue | ReferenceValue;
