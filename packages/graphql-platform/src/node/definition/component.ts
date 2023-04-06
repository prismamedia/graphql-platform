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

export type Component<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> =
  | Leaf<TRequestContext, TConnector, TContainer>
  | Edge<TRequestContext, TConnector, TContainer>;

export const isComponent = <
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
>(
  maybeComponent: unknown,
): maybeComponent is Component<TRequestContext, TConnector, TContainer> =>
  maybeComponent instanceof Leaf || maybeComponent instanceof Edge;

export type ComponentValue = LeafValue | ReferenceValue;
