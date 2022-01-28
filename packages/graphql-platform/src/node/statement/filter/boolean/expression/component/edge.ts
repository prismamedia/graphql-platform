import { EdgeExistsFilter } from './edge/exists.js';

export * from './edge/exists.js';

export type EdgeFilter = EdgeExistsFilter;

export const isEdgeFilter = (
  maybeEdgeFilter: unknown,
): maybeEdgeFilter is EdgeFilter => maybeEdgeFilter instanceof EdgeExistsFilter;
