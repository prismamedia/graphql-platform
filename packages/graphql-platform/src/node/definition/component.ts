import type { ConnectorInterface } from '../../connector-interface.js';
import type {
  Edge,
  EdgeConfig,
  EdgeUpdate,
  EdgeValue,
} from './component/edge.js';
import type {
  Leaf,
  LeafConfig,
  LeafUpdate,
  LeafValue,
} from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | LeafConfig<TRequestContext, TConnector>
  | EdgeConfig<TRequestContext, TConnector>;

export type Component<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = Leaf<TRequestContext, TConnector> | Edge<TRequestContext, TConnector>;

export type ComponentValue = LeafValue | EdgeValue;

export type ComponentUpdate = LeafUpdate | EdgeUpdate;
