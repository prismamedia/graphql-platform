import { LeafOrdering } from './component/leaf.js';

export * from './component/leaf.js';

export type ComponentOrdering = LeafOrdering;

export const isComponentOrdering = (
  maybeOrdering: unknown,
): maybeOrdering is ComponentOrdering => maybeOrdering instanceof LeafOrdering;
