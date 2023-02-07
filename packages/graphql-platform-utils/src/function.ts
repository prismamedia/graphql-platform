import { UnexpectedValueError } from './error.js';
import { isNil, type Nillable } from './nil.js';
import type { Path } from './path.js';

export function assertFunction(
  maybeFunction: unknown,
  path?: Path,
): asserts maybeFunction is Function {
  if (typeof maybeFunction !== 'function') {
    throw new UnexpectedValueError(`a function`, maybeFunction, {
      path,
    });
  }
}

export function ensureFunction(maybeFunction: unknown, path?: Path): Function {
  assertFunction(maybeFunction, path);

  return maybeFunction;
}

export function assertNillableFunction(
  maybeNillableFunction: unknown,
  path?: Path,
): asserts maybeNillableFunction is Nillable<Function> {
  if (!isNil(maybeNillableFunction)) {
    assertFunction(maybeNillableFunction, path);
  }
}

export function ensureNillableFunction(
  maybeNillableFunction: unknown,
  path?: Path,
): Nillable<Function> {
  assertNillableFunction(maybeNillableFunction, path);

  return maybeNillableFunction;
}
