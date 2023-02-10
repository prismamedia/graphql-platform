import { MultipleReverseEdgeCountFilter } from './multiple/count.js';
import { MultipleReverseEdgeExistsFilter } from './multiple/exists.js';

export * from './multiple/count.js';
export * from './multiple/exists.js';

export type MultipleReverseEdgeFilter =
  | MultipleReverseEdgeCountFilter
  | MultipleReverseEdgeExistsFilter;

export const isMultipleReverseEdgeFilter = (
  maybeMultipleReverseEdgeFilter: unknown,
): maybeMultipleReverseEdgeFilter is MultipleReverseEdgeFilter =>
  maybeMultipleReverseEdgeFilter instanceof MultipleReverseEdgeCountFilter ||
  maybeMultipleReverseEdgeFilter instanceof MultipleReverseEdgeExistsFilter;
