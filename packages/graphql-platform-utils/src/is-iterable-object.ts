export const isIterableObject = <T>(
  maybeIterableObject: unknown,
): maybeIterableObject is Iterable<T> =>
  maybeIterableObject != null &&
  typeof maybeIterableObject === 'object' &&
  typeof (maybeIterableObject as any)[Symbol.iterator] === 'function';
