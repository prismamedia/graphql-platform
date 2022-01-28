import type { ReverseEdgeMultipleCountOutputType } from './reverse-edge/multiple-count.js';
import type { ReverseEdgeMultipleHeadOutputType } from './reverse-edge/multiple-head.js';
import type { ReverseEdgeUniqueHeadOutputType } from './reverse-edge/unique-head.js';

export * from './reverse-edge/multiple-count.js';
export * from './reverse-edge/multiple-head.js';
export * from './reverse-edge/unique-head.js';

export type ReverseEdgeOutputType =
  | ReverseEdgeMultipleCountOutputType
  | ReverseEdgeMultipleHeadOutputType
  | ReverseEdgeUniqueHeadOutputType;
