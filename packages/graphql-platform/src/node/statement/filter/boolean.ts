import {
  isBooleanExpression,
  type BooleanExpression,
} from './boolean/expression.js';
import {
  isBooleanOperation,
  type BooleanOperation,
} from './boolean/operation.js';
import { BooleanValue } from './boolean/value.js';

export * from './boolean/expression.js';
export * from './boolean/operation.js';
export * from './boolean/value.js';

export type BooleanFilter = BooleanExpression | BooleanOperation | BooleanValue;

export const isBooleanFilter = (
  maybeBooleanFilter: unknown,
): maybeBooleanFilter is BooleanFilter =>
  isBooleanExpression(maybeBooleanFilter) ||
  isBooleanOperation(maybeBooleanFilter) ||
  maybeBooleanFilter instanceof BooleanValue;
