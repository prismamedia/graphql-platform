import type { Input } from '@prismamedia/graphql-platform-utils';
import type { ComponentCreationInput } from './field/component.js';
import type { ReverseEdgeCreationInput } from './field/reverse-edge.js';

export * from './field/component.js';
export * from './field/reverse-edge.js';

export type FieldCreationInput =
  | ComponentCreationInput
  | ReverseEdgeCreationInput
  | Input;
