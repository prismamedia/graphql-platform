import { MultipleReverseEdgeUpdateInput } from './reverse-edge/multiple.js';
import { UniqueReverseEdgeUpdateInput } from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeUpdateInput =
  | MultipleReverseEdgeUpdateInput
  | UniqueReverseEdgeUpdateInput;

export const isReverseEdgeUpdateInput = (
  maybeReverseEdgeUpdateInput: unknown,
): boolean =>
  maybeReverseEdgeUpdateInput instanceof MultipleReverseEdgeUpdateInput ||
  maybeReverseEdgeUpdateInput instanceof UniqueReverseEdgeUpdateInput;
