import { Scalar } from '../types/scalar';

// TODO: replace by a negated type "not () => any" cf: https://github.com/Microsoft/TypeScript/pull/29317
type NotFunction = undefined | null | Scalar | Object | any[];

export type Thunk<T extends NotFunction> = (() => T) | T;

export function getThunkValue<T extends NotFunction>(thunk: Thunk<T>): T {
  return typeof thunk === 'function' ? thunk() : thunk;
}
