import { AbstractOrderingExpression } from './abstract-expression.js';
import {
  isComponentOrdering,
  type ComponentOrdering,
} from './expression/component.js';
import {
  isReverseEdgeOrdering,
  type ReverseEdgeOrdering,
} from './expression/reverse-edge.js';

export * from './abstract-expression.js';
export * from './expression/component.js';
export * from './expression/reverse-edge.js';

export type OrderingExpression =
  | ComponentOrdering
  | ReverseEdgeOrdering
  | AbstractOrderingExpression;

export const isOrderingExpression = (
  maybeOrderingExpression: unknown,
): maybeOrderingExpression is OrderingExpression =>
  isComponentOrdering(maybeOrderingExpression) ||
  isReverseEdgeOrdering(maybeOrderingExpression) ||
  maybeOrderingExpression instanceof AbstractOrderingExpression;
