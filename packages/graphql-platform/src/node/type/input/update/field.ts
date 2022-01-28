import type { Input } from '@prismamedia/graphql-platform-utils';
import type { ComponentUpdateInput } from './field/component.js';
import type { ReverseEdgeUpdateInput } from './field/reverse-edge.js';

export * from './field/component.js';
export * from './field/reverse-edge.js';

export type FieldUpdateInput =
  | ComponentUpdateInput
  | ReverseEdgeUpdateInput
  | Input;
