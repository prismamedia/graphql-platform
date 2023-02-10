import { UniqueReverseEdgeHeadSelection } from './unique/head.js';

export * from './unique/head.js';

export type UniqueReverseEdgeSelection = UniqueReverseEdgeHeadSelection;

export const isUniqueReverseEdgeSelection = (
  maybeSelection: unknown,
): maybeSelection is UniqueReverseEdgeSelection =>
  maybeSelection instanceof UniqueReverseEdgeHeadSelection;
