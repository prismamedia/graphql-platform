import { MultipleReverseEdgeCountSelection } from './multiple/count.js';
import { MultipleReverseEdgeHeadSelection } from './multiple/head.js';

export * from './multiple/count.js';
export * from './multiple/head.js';

export type MultipleReverseEdgeSelection =
  | MultipleReverseEdgeCountSelection
  | MultipleReverseEdgeHeadSelection;

export const isMultipleReverseEdgeSelection = (
  maybeSelection: unknown,
): maybeSelection is MultipleReverseEdgeSelection =>
  maybeSelection instanceof MultipleReverseEdgeCountSelection ||
  maybeSelection instanceof MultipleReverseEdgeHeadSelection;
