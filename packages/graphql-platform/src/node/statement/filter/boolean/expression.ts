import { AbstractBooleanExpression } from './expression/abstract.js';
import {
  isComponentFilter,
  type ComponentFilter,
} from './expression/component.js';
import {
  isReverseEdgeFilter,
  type ReverseEdgeFilter,
} from './expression/reverse-edge.js';

export * from './expression/abstract.js';
export * from './expression/component.js';
export * from './expression/reverse-edge.js';

export type BooleanExpression =
  | ComponentFilter
  | ReverseEdgeFilter
  | AbstractBooleanExpression;

export const isBooleanExpression = (
  maybeBooleanExpression: unknown,
): maybeBooleanExpression is BooleanExpression =>
  isComponentFilter(maybeBooleanExpression) ||
  isReverseEdgeFilter(maybeBooleanExpression) ||
  maybeBooleanExpression instanceof AbstractBooleanExpression;
