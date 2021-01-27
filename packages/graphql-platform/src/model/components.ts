import { ConnectorInterface } from '../connector';
import { Leaf, LeafConfig, LeafValue } from './components/leaf';
import {
  Reference,
  ReferenceConfig,
  ReferenceValue,
} from './components/reference';

export * from './components/leaf';
export * from './components/reference';

export type ComponentConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> =
  | LeafConfig<TRequestContext, TConnector>
  | ReferenceConfig<TRequestContext, TConnector>;

export type Component<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Leaf<TRequestContext, TConnector> | Reference<TRequestContext, TConnector>;

export const isComponent = <
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
>(
  maybeComponent: unknown,
): maybeComponent is Component<TRequestContext, TConnector> =>
  maybeComponent instanceof Leaf || maybeComponent instanceof Reference;

export type ComponentValue = LeafValue | ReferenceValue;
