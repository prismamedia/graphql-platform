import type { NodeCreation } from './change/creation.js';
import type { NodeDeletion } from './change/deletion.js';
import type { NodeUpdate } from './change/update.js';

export * from './change/aggregation.js';
export * from './change/creation.js';
export * from './change/deletion.js';
export * from './change/update.js';

export type NodeChange<TRequestContext extends object = any> =
  | NodeCreation<TRequestContext>
  | NodeUpdate<TRequestContext>
  | NodeDeletion<TRequestContext>;
