import {
  isMultipleReverseEdgeFilter,
  type MultipleReverseEdgeFilter,
} from './reverse-edge/multiple.js';
import {
  isUniqueReverseEdgeFilter,
  type UniqueReverseEdgeFilter,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeFilter =
  | UniqueReverseEdgeFilter
  | MultipleReverseEdgeFilter;

export const isReverseEdgeFilter = (
  maybeReverseEdgeFilter: unknown,
): maybeReverseEdgeFilter is ReverseEdgeFilter =>
  isUniqueReverseEdgeFilter(maybeReverseEdgeFilter) ||
  isMultipleReverseEdgeFilter(maybeReverseEdgeFilter);
