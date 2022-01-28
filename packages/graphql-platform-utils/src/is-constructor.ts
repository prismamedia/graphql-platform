import type { Constructor } from 'type-fest';

/**
 * @see https://262.ecma-international.org/#sec-isconstructor
 */
export const isConstructor = <T, TArgs extends unknown[]>(
  maybeConstructor: unknown,
): maybeConstructor is Constructor<T, TArgs> =>
  typeof maybeConstructor === 'function' &&
  typeof maybeConstructor.name === 'string' &&
  typeof maybeConstructor.prototype === 'object' &&
  maybeConstructor.prototype.constructor === maybeConstructor;
