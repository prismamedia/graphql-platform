import type { ConnectorInterface } from '../../connector-interface.js';
import type { Edge, EdgeConfig, ReferenceValue } from './component/edge.js';
import type { Leaf, LeafConfig, LeafValue } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentConfig<TConnector extends ConnectorInterface = any> =
  | LeafConfig<TConnector>
  | EdgeConfig<TConnector>;

export type Component<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TServiceContainer extends object = any,
> =
  | Leaf<TRequestContext, TConnector, TServiceContainer>
  | Edge<TRequestContext, TConnector, TServiceContainer>;

export type ComponentValue = LeafValue | ReferenceValue;
