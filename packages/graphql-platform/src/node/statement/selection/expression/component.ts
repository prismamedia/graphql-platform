import { type EdgeSelection, isEdgeSelection } from './component/edge.js';
import { LeafSelection } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentSelection = LeafSelection | EdgeSelection;

export const isComponentSelection = (
  maybeSelection: unknown,
): maybeSelection is ComponentSelection =>
  maybeSelection instanceof LeafSelection || isEdgeSelection(maybeSelection);
