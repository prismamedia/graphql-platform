import { isScalarTypeName } from '@prismamedia/graphql-platform-scalars';
import { isEnumType } from 'graphql';
import { IConnector } from '../connector';
import { Edge, TEdgeConfig } from './component/edge';
import { Leaf, TLeafConfig } from './component/leaf';

export * from './component/edge';
export * from './component/leaf';

export type TComponentConfig<TContext, TConnector extends IConnector> =
  | TLeafConfig<TContext, TConnector>
  | TEdgeConfig<TContext, TConnector>;

export const isLeafComponentConfig = <TContext, TConnector extends IConnector>(
  config: TComponentConfig<TContext, TConnector>,
): config is TLeafConfig<TContext, TConnector> =>
  isEnumType(config.type) || isScalarTypeName(config.type);

export type TComponent<TConnector extends IConnector = any> =
  | Leaf<TConnector>
  | Edge<TConnector>;

export const isLeafEntry = <TConnector extends IConnector>(
  entry: [string, TComponent<TConnector>],
): entry is [string, Leaf<TConnector>] => entry[1] instanceof Leaf;

export const isEdgeEntry = <TConnector extends IConnector>(
  entry: [string, TComponent<TConnector>],
): entry is [string, Edge<TConnector>] => entry[1] instanceof Edge;
