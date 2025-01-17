import { type EdgeFilter, isEdgeFilter } from './component/edge.js';
import { type LeafFilter, isLeafFilter } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentFilter = LeafFilter | EdgeFilter;

export const isComponentFilter = (
  maybeComponentFilter: unknown,
): maybeComponentFilter is ComponentFilter =>
  isLeafFilter(maybeComponentFilter) || isEdgeFilter(maybeComponentFilter);
