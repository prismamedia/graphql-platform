import { ReverseEdgeMultipleCountSelection } from './reverse-edge/multiple-count.js';
import { ReverseEdgeMultipleHeadSelection } from './reverse-edge/multiple-head.js';
import { ReverseEdgeUniqueHeadSelection } from './reverse-edge/unique-head.js';

export * from './reverse-edge/multiple-count.js';
export * from './reverse-edge/multiple-head.js';
export * from './reverse-edge/unique-head.js';

export type ReverseEdgeSelection =
  | ReverseEdgeMultipleCountSelection
  | ReverseEdgeMultipleHeadSelection
  | ReverseEdgeUniqueHeadSelection;

export const isReverseEdgeSelection = (
  maybeReverseEdgeSelection: unknown,
): maybeReverseEdgeSelection is ReverseEdgeSelection =>
  maybeReverseEdgeSelection instanceof ReverseEdgeMultipleCountSelection ||
  maybeReverseEdgeSelection instanceof ReverseEdgeMultipleHeadSelection ||
  maybeReverseEdgeSelection instanceof ReverseEdgeUniqueHeadSelection;
