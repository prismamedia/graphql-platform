import { ReverseEdgeMultipleUpdateInput } from './reverse-edge/multiple.js';
import { ReverseEdgeUniqueUpdateInput } from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeUpdateInput =
  | ReverseEdgeMultipleUpdateInput
  | ReverseEdgeUniqueUpdateInput;

export const isReverseEdgeUpdateInput = (
  maybeReverseEdgeUpdateInput: unknown,
): boolean =>
  maybeReverseEdgeUpdateInput instanceof ReverseEdgeMultipleUpdateInput ||
  maybeReverseEdgeUpdateInput instanceof ReverseEdgeUniqueUpdateInput;
