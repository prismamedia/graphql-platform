import {
  isReverseEdgeMultipleSelection,
  ReverseEdgeMultipleSelection,
} from './reverse-edge/multiple.js';
import {
  isReverseEdgeUniqueSelection,
  ReverseEdgeUniqueSelection,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeSelection =
  | ReverseEdgeMultipleSelection
  | ReverseEdgeUniqueSelection;

export const isReverseEdgeSelection = (
  maybeSelection: unknown,
): maybeSelection is ReverseEdgeSelection =>
  isReverseEdgeMultipleSelection(maybeSelection) ||
  isReverseEdgeUniqueSelection(maybeSelection);
