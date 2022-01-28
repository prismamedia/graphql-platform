import { AndOperation } from './operation/and.js';
import { NotOperation } from './operation/not.js';
import { OrOperation } from './operation/or.js';

export * from './operation/and.js';
export * from './operation/not.js';
export * from './operation/or.js';

export type BooleanOperation = AndOperation | OrOperation | NotOperation;

export const isBooleanOperation = (
  maybeBooleanOperation: unknown,
): maybeBooleanOperation is BooleanOperation =>
  maybeBooleanOperation instanceof AndOperation ||
  maybeBooleanOperation instanceof OrOperation ||
  maybeBooleanOperation instanceof NotOperation;
