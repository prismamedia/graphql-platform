import {
  isReverseEdgeMultipleFilter,
  ReverseEdgeMultipleFilter,
} from './reverse-edge/multiple.js';
import {
  isReverseEdgeUniqueFilter,
  ReverseEdgeUniqueFilter,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeFilter =
  | ReverseEdgeUniqueFilter
  | ReverseEdgeMultipleFilter;

export const isReverseEdgeFilter = (
  maybeReverseEdgeFilter: unknown,
): maybeReverseEdgeFilter is ReverseEdgeFilter =>
  isReverseEdgeUniqueFilter(maybeReverseEdgeFilter) ||
  isReverseEdgeMultipleFilter(maybeReverseEdgeFilter);
