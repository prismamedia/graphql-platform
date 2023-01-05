import { UnexpectedValueError } from '../error.js';
import { isNil, type Nillable } from '../nil.js';
import type { Path } from '../path.js';
import { isPlainObject, type PlainObject } from '../plain-object.js';

export function assertPlainObjectConfig(
  maybePlainObject: unknown,
  path?: Path,
): asserts maybePlainObject is PlainObject {
  if (!isPlainObject(maybePlainObject)) {
    throw new UnexpectedValueError(`a plain-object`, maybePlainObject, {
      path,
    });
  }
}

export function ensurePlainObjectConfig(
  maybePlainObject: unknown,
  path?: Path,
): PlainObject {
  assertPlainObjectConfig(maybePlainObject, path);

  return maybePlainObject;
}

export function assertNillablePlainObjectConfig(
  maybeNillablePlainObject: unknown,
  path?: Path,
): asserts maybeNillablePlainObject is Nillable<PlainObject> {
  if (
    !isNil(maybeNillablePlainObject) &&
    !isPlainObject(maybeNillablePlainObject)
  ) {
    throw new UnexpectedValueError(`a plain-object`, maybeNillablePlainObject, {
      path,
    });
  }
}

export function ensureNillablePlainObjectConfig(
  maybeNillablePlainObject: unknown,
  path?: Path,
): Nillable<PlainObject> {
  assertNillablePlainObjectConfig(maybeNillablePlainObject, path);

  return maybeNillablePlainObject;
}
