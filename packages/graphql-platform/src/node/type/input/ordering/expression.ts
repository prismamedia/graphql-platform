import { LeafOrderingInputType } from './expression/leaf.js';
import { ReverseEdgeMultipleCountOrderingInputType } from './expression/reverse-edge-multiple-count.js';

export * from './expression/leaf.js';
export * from './expression/reverse-edge-multiple-count.js';

export type OrderingExpressionInputType =
  | LeafOrderingInputType
  | ReverseEdgeMultipleCountOrderingInputType;

export const isOrderingExpressionInputType = (
  maybeOrderingExpressionInputType: unknown,
): maybeOrderingExpressionInputType is OrderingExpressionInputType =>
  maybeOrderingExpressionInputType instanceof LeafOrderingInputType ||
  maybeOrderingExpressionInputType instanceof
    ReverseEdgeMultipleCountOrderingInputType;
