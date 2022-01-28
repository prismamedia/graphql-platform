import { ReverseEdgeUniqueExistsFilter } from './unique/exists.js';

export * from './unique/exists.js';

export type ReverseEdgeUniqueFilter = ReverseEdgeUniqueExistsFilter;

export const isReverseEdgeUniqueFilter = (
  maybeReverseEdgeUniqueFilter: unknown,
): maybeReverseEdgeUniqueFilter is ReverseEdgeUniqueFilter =>
  maybeReverseEdgeUniqueFilter instanceof ReverseEdgeUniqueExistsFilter;
