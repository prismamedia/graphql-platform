import {
  isMultipleReverseEdgeSelection,
  MultipleReverseEdgeSelection,
} from './reverse-edge/multiple.js';
import {
  isUniqueReverseEdgeSelection,
  UniqueReverseEdgeSelection,
} from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeSelection =
  | MultipleReverseEdgeSelection
  | UniqueReverseEdgeSelection;

export const isReverseEdgeSelection = (
  maybeSelection: unknown,
): maybeSelection is ReverseEdgeSelection =>
  isMultipleReverseEdgeSelection(maybeSelection) ||
  isUniqueReverseEdgeSelection(maybeSelection);
