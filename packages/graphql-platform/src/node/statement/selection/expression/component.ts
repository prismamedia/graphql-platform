import { EdgeHeadSelection } from './component/edge-head.js';
import { LeafSelection } from './component/leaf.js';

export * from './component/edge-head.js';
export * from './component/leaf.js';

export type ComponentSelection = LeafSelection | EdgeHeadSelection;

export const isComponentSelection = (
  maybeComponentSelection: unknown,
): maybeComponentSelection is ComponentSelection =>
  maybeComponentSelection instanceof LeafSelection ||
  maybeComponentSelection instanceof EdgeHeadSelection;
