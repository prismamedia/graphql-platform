import type { ConnectorInterface } from '../connector-interface.js';
import { NodeCreation } from './change/creation.js';
import { NodeDeletion } from './change/deletion.js';
import { NodeUpdate } from './change/update.js';

export * from './change/aggregation.js';
export * from './change/creation.js';
export * from './change/deletion.js';
export * from './change/update.js';

export type NodeChange<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> =
  | NodeCreation<TRequestContext, TConnector, TContainer>
  | NodeUpdate<TRequestContext, TConnector, TContainer>
  | NodeDeletion<TRequestContext, TConnector, TContainer>;

export const filterNodeChange = (change: NodeChange): boolean =>
  !(change instanceof NodeUpdate && change.isEmpty()) &&
  change.node.filterChange(change);

export const isNodeChange = <
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
>(
  maybeChange: unknown,
): maybeChange is NodeChange<TRequestContext, TConnector, TContainer> =>
  maybeChange instanceof NodeCreation ||
  maybeChange instanceof NodeUpdate ||
  maybeChange instanceof NodeDeletion;
