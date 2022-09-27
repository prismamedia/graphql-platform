import { EdgeHeadSelection } from './edge/head.js';

export * from './edge/head.js';

export type EdgeSelection = EdgeHeadSelection;

export const isEdgeSelection = (
  maybeSelection: unknown,
): maybeSelection is EdgeSelection =>
  maybeSelection instanceof EdgeHeadSelection;
