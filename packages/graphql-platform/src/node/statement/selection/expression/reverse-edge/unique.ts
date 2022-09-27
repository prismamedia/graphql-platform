import { ReverseEdgeUniqueHeadSelection } from './unique/head.js';

export * from './unique/head.js';

export type ReverseEdgeUniqueSelection = ReverseEdgeUniqueHeadSelection;

export const isReverseEdgeUniqueSelection = (
  maybeSelection: unknown,
): maybeSelection is ReverseEdgeUniqueSelection =>
  maybeSelection instanceof ReverseEdgeUniqueHeadSelection;
