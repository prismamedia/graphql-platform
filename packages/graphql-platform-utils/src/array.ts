import { UnexpectedValueError } from './error.js';
import { isNil, type Nillable } from './nil.js';
import type { Path } from './path.js';

export function assertArray<T>(
  maybeArray: unknown,
  path?: Path,
): asserts maybeArray is T[] {
  if (!Array.isArray(maybeArray)) {
    throw new UnexpectedValueError(`an array`, maybeArray, { path });
  }
}

export function ensureArray<T>(maybeArray: unknown, path?: Path): T[] {
  assertArray<T>(maybeArray, path);

  return maybeArray;
}

export function assertNillableArray<T>(
  maybeNillableArray: unknown,
  path?: Path,
): asserts maybeNillableArray is Nillable<T[]> {
  if (!isNil(maybeNillableArray)) {
    assertArray(maybeNillableArray, path);
  }
}

export function ensureNillableArray<T>(
  maybeNillableArray: unknown,
  path?: Path,
): Nillable<T[]> {
  assertNillableArray<T>(maybeNillableArray, path);

  return maybeNillableArray;
}
