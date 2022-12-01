import { LeafOrderingInput } from './expression/leaf.js';
import { ReverseEdgeMultipleCountOrderingInput } from './expression/reverse-edge-multiple-count.js';

export * from './expression/leaf.js';
export * from './expression/reverse-edge-multiple-count.js';

export type OrderingExpressionInput =
  | LeafOrderingInput
  | ReverseEdgeMultipleCountOrderingInput;

export const isOrderingExpressionInput = (
  maybeOrderingExpressionInput: unknown,
): maybeOrderingExpressionInput is OrderingExpressionInput =>
  maybeOrderingExpressionInput instanceof LeafOrderingInput ||
  maybeOrderingExpressionInput instanceof ReverseEdgeMultipleCountOrderingInput;
