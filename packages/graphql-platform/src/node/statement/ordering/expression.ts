import { LeafOrdering } from './expression/leaf.js';
import { MultipleReverseEdgeCountOrdering } from './expression/reverse-edge-multiple-count.js';

export * from './expression/leaf.js';
export * from './expression/reverse-edge-multiple-count.js';

export type OrderingExpression =
  | LeafOrdering
  | MultipleReverseEdgeCountOrdering;

export const isOrderingExpression = (
  maybeOrderingExpression: unknown,
): maybeOrderingExpression is OrderingExpression =>
  maybeOrderingExpression instanceof LeafOrdering ||
  maybeOrderingExpression instanceof MultipleReverseEdgeCountOrdering;
