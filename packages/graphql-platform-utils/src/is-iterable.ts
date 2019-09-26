export const isIterable = <T>(
  maybeIterable: any,
): maybeIterable is Iterable<T> =>
  maybeIterable != null && typeof maybeIterable[Symbol.iterator] === 'function';
