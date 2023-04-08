import { MultipleReverseEdgeCountOrdering } from './reverse-edge/multiple-count.js';

export * from './reverse-edge/multiple-count.js';

export type ReverseEdgeOrdering = MultipleReverseEdgeCountOrdering;

export const isReverseEdgeOrdering = (
  maybeOrdering: unknown,
): maybeOrdering is ReverseEdgeOrdering =>
  maybeOrdering instanceof MultipleReverseEdgeCountOrdering;
