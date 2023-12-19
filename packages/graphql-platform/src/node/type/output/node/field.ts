import type { ComponentOutputType } from './field/component.js';
import type { ReverseEdgeOutputType } from './field/reverse-edge.js';
import type { VirtualOutputType } from './field/virtual.js';

export * from './field/component.js';
export * from './field/reverse-edge.js';
export * from './field/virtual.js';

export type NodeFieldOutputType =
  | ComponentOutputType
  | ReverseEdgeOutputType
  | VirtualOutputType;
