import { UnexpectedValueError } from './error.js';
import { isNil, type Nillable } from './nil.js';
import type { Path } from './path.js';

export const isIterableObject = <T>(
  maybeIterableObject: unknown,
): maybeIterableObject is Iterable<T> =>
  maybeIterableObject != null &&
  typeof maybeIterableObject === 'object' &&
  typeof (maybeIterableObject as any)[Symbol.iterator] === 'function';

export function assertIterableObject<T>(
  maybeIterableObject: unknown,
  path?: Path,
): asserts maybeIterableObject is Iterable<T> {
  if (!isIterableObject(maybeIterableObject)) {
    throw new UnexpectedValueError(`a plain-object`, maybeIterableObject, {
      path,
    });
  }
}

export function assertNillableIterableObject<T>(
  maybeNillableIterableObject: unknown,
  path?: Path,
): asserts maybeNillableIterableObject is Nillable<Iterable<T>> {
  if (!isNil(maybeNillableIterableObject)) {
    assertIterableObject(maybeNillableIterableObject, path);
  }
}
