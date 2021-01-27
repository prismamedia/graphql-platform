import { UnexpectedValueError } from './errors';
import { Path } from './path';

export const isIterable = <T>(
  maybeIterable: any,
): maybeIterable is Iterable<T> =>
  maybeIterable != null && typeof maybeIterable[Symbol.iterator] === 'function';

export function assertIterable<T>(
  maybeIterable: unknown,
  path?: Path,
  expectation: string = 'an iterable',
): asserts maybeIterable is Iterable<T> {
  if (!isIterable(maybeIterable)) {
    throw new UnexpectedValueError(maybeIterable, expectation, path);
  }
}

export const isIterableObject = <T>(
  maybeIterableObject: any,
): maybeIterableObject is Iterable<T> =>
  isIterable(maybeIterableObject) && typeof maybeIterableObject === 'object';

export function assertIterableObject<T>(
  maybeIterableObject: unknown,
  path?: Path,
  expectation: string = 'an iterable',
): asserts maybeIterableObject is Iterable<T> {
  if (!isIterableObject(maybeIterableObject)) {
    throw new UnexpectedValueError(maybeIterableObject, expectation, path);
  }
}
