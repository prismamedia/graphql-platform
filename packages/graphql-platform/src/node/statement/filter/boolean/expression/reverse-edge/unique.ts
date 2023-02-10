import { UniqueReverseEdgeExistsFilter } from './unique/exists.js';

export * from './unique/exists.js';

export type UniqueReverseEdgeFilter = UniqueReverseEdgeExistsFilter;

export const isUniqueReverseEdgeFilter = (
  maybeUniqueReverseEdgeFilter: unknown,
): maybeUniqueReverseEdgeFilter is UniqueReverseEdgeFilter =>
  maybeUniqueReverseEdgeFilter instanceof UniqueReverseEdgeExistsFilter;
