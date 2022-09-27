import { ReverseEdgeMultipleCountSelection } from './multiple/count.js';
import { ReverseEdgeMultipleHeadSelection } from './multiple/head.js';

export * from './multiple/count.js';
export * from './multiple/head.js';

export type ReverseEdgeMultipleSelection =
  | ReverseEdgeMultipleCountSelection
  | ReverseEdgeMultipleHeadSelection;

export const isReverseEdgeMultipleSelection = (
  maybeSelection: unknown,
): maybeSelection is ReverseEdgeMultipleSelection =>
  maybeSelection instanceof ReverseEdgeMultipleCountSelection ||
  maybeSelection instanceof ReverseEdgeMultipleHeadSelection;
