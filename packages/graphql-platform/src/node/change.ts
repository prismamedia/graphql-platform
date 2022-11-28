import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';
import type { NodeCreation } from './change/creation.js';
import type { NodeDeletion } from './change/deletion.js';
import type { NodeUpdate } from './change/update.js';

export * from './change/aggregation.js';
export * from './change/creation.js';
export * from './change/deletion.js';
export * from './change/update.js';

export type NodeChange<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | NodeCreation<TRequestContext, TConnector>
  | NodeUpdate<TRequestContext, TConnector>
  | NodeDeletion<TRequestContext, TConnector>;

export type NodeChangeListener<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = (change: NodeChange<TRequestContext, TConnector>) => Promisable<void>;

export type NodeChangeErrorListener<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> = (error: Error) => Promisable<void>;
