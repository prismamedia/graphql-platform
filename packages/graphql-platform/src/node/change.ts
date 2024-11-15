import { NodeCreation } from './change/creation.js';
import { NodeDeletion } from './change/deletion.js';
import { NodeUpdate } from './change/update.js';

export * from './change/aggregation.js';
export * from './change/creation.js';
export * from './change/deletion.js';
export * from './change/dependency.js';
export * from './change/update.js';

export type NodeChange<TRequestContext extends object = any> =
  | NodeCreation<TRequestContext>
  | NodeUpdate<TRequestContext>
  | NodeDeletion<TRequestContext>;

export const isNodeChange = (maybeChange: unknown): maybeChange is NodeChange =>
  maybeChange instanceof NodeCreation ||
  maybeChange instanceof NodeUpdate ||
  maybeChange instanceof NodeDeletion;

export const isActualNodeChange = (change: NodeChange): boolean =>
  !(change instanceof NodeUpdate && change.isEmpty());
