import { LeafOrderingInput } from './expression/leaf.js';
import { MultipleReverseEdgeCountOrderingInput } from './expression/reverse-edge-multiple-count.js';

export * from './expression/leaf.js';
export * from './expression/reverse-edge-multiple-count.js';

export type OrderingExpressionInput =
  | LeafOrderingInput
  | MultipleReverseEdgeCountOrderingInput;

export const isOrderingExpressionInput = (
  maybeOrderingExpressionInput: unknown,
): maybeOrderingExpressionInput is OrderingExpressionInput =>
  maybeOrderingExpressionInput instanceof LeafOrderingInput ||
  maybeOrderingExpressionInput instanceof MultipleReverseEdgeCountOrderingInput;
