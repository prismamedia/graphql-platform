import { ReverseEdgeMultipleCountFilter } from './multiple/count.js';
import { ReverseEdgeMultipleExistsFilter } from './multiple/exists.js';

export * from './multiple/count.js';
export * from './multiple/exists.js';

export type ReverseEdgeMultipleFilter =
  | ReverseEdgeMultipleCountFilter
  | ReverseEdgeMultipleExistsFilter;

export const isReverseEdgeMultipleFilter = (
  maybeReverseEdgeMultipleFilter: unknown,
): maybeReverseEdgeMultipleFilter is ReverseEdgeMultipleFilter =>
  maybeReverseEdgeMultipleFilter instanceof ReverseEdgeMultipleCountFilter ||
  maybeReverseEdgeMultipleFilter instanceof ReverseEdgeMultipleExistsFilter;
