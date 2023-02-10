import { MultipleReverseEdgeCreationInput } from './reverse-edge/multiple.js';
import { UniqueReverseEdgeCreationInput } from './reverse-edge/unique.js';

export * from './reverse-edge/multiple.js';
export * from './reverse-edge/unique.js';

export type ReverseEdgeCreationInput =
  | MultipleReverseEdgeCreationInput
  | UniqueReverseEdgeCreationInput;

export const isReverseEdgeCreationInput = (
  maybeReverseEdgeCreationInput: unknown,
): boolean =>
  maybeReverseEdgeCreationInput instanceof MultipleReverseEdgeCreationInput ||
  maybeReverseEdgeCreationInput instanceof UniqueReverseEdgeCreationInput;
