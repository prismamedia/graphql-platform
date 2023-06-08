import { UnexpectedValueError } from './error.js';
import { isNil, type Nillable } from './nil.js';
import type { Path } from './path.js';

export type PlainObject = { [key: string]: any };

export const isPlainObject = (
  maybePlainObject: unknown,
): maybePlainObject is PlainObject =>
  typeof maybePlainObject === 'object' &&
  maybePlainObject !== null &&
  !(
    'then' in maybePlainObject && typeof maybePlainObject.then === 'function'
  ) &&
  Object.prototype.toString.call(maybePlainObject) === '[object Object]';

export function assertPlainObject(
  maybePlainObject: unknown,
  path?: Path,
): asserts maybePlainObject is PlainObject {
  if (!isPlainObject(maybePlainObject)) {
    throw new UnexpectedValueError(`a plain-object`, maybePlainObject, {
      path,
    });
  }
}

export function ensurePlainObject(
  maybePlainObject: unknown,
  path?: Path,
): PlainObject {
  assertPlainObject(maybePlainObject, path);

  return maybePlainObject;
}

export function assertNillablePlainObject(
  maybeNillablePlainObject: unknown,
  path?: Path,
): asserts maybeNillablePlainObject is Nillable<PlainObject> {
  if (!isNil(maybeNillablePlainObject)) {
    assertPlainObject(maybeNillablePlainObject, path);
  }
}

export function ensureNillablePlainObject(
  maybeNillablePlainObject: unknown,
  path?: Path,
): Nillable<PlainObject> {
  assertNillablePlainObject(maybeNillablePlainObject, path);

  return maybeNillablePlainObject;
}
