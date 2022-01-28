import { ReverseEdgeMultipleCreationInput } from './reverse-edge/multiple.js';
import { ReverseEdgeUniqueCreationInput } from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeCreationInput =
  | ReverseEdgeMultipleCreationInput
  | ReverseEdgeUniqueCreationInput;

export const isReverseEdgeCreationInput = (
  maybeReverseEdgeCreationInput: unknown,
): boolean =>
  maybeReverseEdgeCreationInput instanceof ReverseEdgeMultipleCreationInput ||
  maybeReverseEdgeCreationInput instanceof ReverseEdgeUniqueCreationInput;
