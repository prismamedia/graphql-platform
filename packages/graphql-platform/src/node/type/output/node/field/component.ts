import type { EdgeHeadOutputType } from './component/edge-head.js';
import type { LeafOutputType } from './component/leaf.js';

export * from './component/edge-head.js';
export * from './component/leaf.js';

export type ComponentOutputType = EdgeHeadOutputType | LeafOutputType;
