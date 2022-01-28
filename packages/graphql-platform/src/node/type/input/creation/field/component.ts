import { EdgeCreationInput } from './component/edge.js';
import { LeafCreationInput } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentCreationInput = LeafCreationInput | EdgeCreationInput;

export const isComponentCreationInput = (
  maybeComponentCreationInput: unknown,
): boolean =>
  maybeComponentCreationInput instanceof LeafCreationInput ||
  maybeComponentCreationInput instanceof EdgeCreationInput;
