import type { MultipleReverseEdgeCountOutputType } from './reverse-edge/multiple-count.js';
import type { MultipleReverseEdgeHeadOutputType } from './reverse-edge/multiple-head.js';
import type { UniqueReverseEdgeHeadOutputType } from './reverse-edge/unique-head.js';

export * from './reverse-edge/multiple-count.js';
export * from './reverse-edge/multiple-head.js';
export * from './reverse-edge/unique-head.js';

export type ReverseEdgeOutputType =
  | MultipleReverseEdgeCountOutputType
  | MultipleReverseEdgeHeadOutputType
  | UniqueReverseEdgeHeadOutputType;
