import { EdgeUpdateInput } from './component/edge.js';
import { LeafUpdateInput } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentUpdateInput = LeafUpdateInput | EdgeUpdateInput;

export const isComponentUpdateInput = (
  maybeComponentUpdateInput: unknown,
): boolean =>
  maybeComponentUpdateInput instanceof LeafUpdateInput ||
  maybeComponentUpdateInput instanceof EdgeUpdateInput;
