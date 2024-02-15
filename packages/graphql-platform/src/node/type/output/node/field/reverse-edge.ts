import { MultipleReverseEdgeCountOutputType } from './reverse-edge/multiple-count.js';
import { MultipleReverseEdgeHeadOutputType } from './reverse-edge/multiple-head.js';
import type { UniqueReverseEdgeHeadOutputType } from './reverse-edge/unique-head.js';

export * from './reverse-edge/multiple-count.js';
export * from './reverse-edge/multiple-head.js';
export * from './reverse-edge/unique-head.js';

export type MultipleReverseEdgeOutputType =
  | MultipleReverseEdgeCountOutputType
  | MultipleReverseEdgeHeadOutputType;

export const isMultipleReverseEdgeOutputType = (
  type: unknown,
): type is MultipleReverseEdgeOutputType =>
  type instanceof MultipleReverseEdgeCountOutputType ||
  type instanceof MultipleReverseEdgeHeadOutputType;

export type ReverseEdgeOutputType =
  | UniqueReverseEdgeHeadOutputType
  | MultipleReverseEdgeOutputType;
