import { EdgeSelection, isEdgeSelection } from './component/edge.js';
import { LeafSelection } from './component/leaf.js';

export * from './component/edge.js';
export * from './component/leaf.js';

export type ComponentSelection = EdgeSelection | LeafSelection;

export const isComponentSelection = (
  maybeSelection: unknown,
): maybeSelection is ComponentSelection =>
  isEdgeSelection(maybeSelection) || maybeSelection instanceof LeafSelection;
