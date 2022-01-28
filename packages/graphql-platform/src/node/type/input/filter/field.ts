import type { BooleanOperationFilterInputType } from './field/boolean-operation.js';
import type { EdgeFilterInputType } from './field/edge.js';
import type { LeafFilterInputType } from './field/leaf.js';
import type { ReverseEdgeFilterInputType } from './field/reverse-edge.js';

export * from './field/boolean-operation.js';
export * from './field/edge.js';
export * from './field/leaf.js';
export * from './field/reverse-edge.js';

export type FieldFilterInputType =
  | BooleanOperationFilterInputType
  | LeafFilterInputType
  | EdgeFilterInputType
  | ReverseEdgeFilterInputType;
