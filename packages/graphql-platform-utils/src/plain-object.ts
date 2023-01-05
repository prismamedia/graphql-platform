import _ from 'lodash';
import { UnexpectedValueError } from './error.js';
import { isNil, Nillable } from './nil.js';
import { Path } from './path.js';

export type PlainObject = { [key: string]: any };

export const isPlainObject = (
  maybePlainObject: unknown,
): maybePlainObject is PlainObject => _.isPlainObject(maybePlainObject);

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
