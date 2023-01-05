import { UnexpectedValueError } from '../error.js';
import { isNil, Nillable } from '../nil.js';
import type { Path } from '../path.js';

export type OptionalFlag = Nillable<boolean>;

export function assertOptionalFlag(
  maybeOptionalFlag: unknown,
  path?: Path,
): asserts maybeOptionalFlag is OptionalFlag {
  if (!isNil(maybeOptionalFlag) && typeof maybeOptionalFlag !== 'boolean') {
    throw new UnexpectedValueError(`a boolean`, maybeOptionalFlag, { path });
  }
}

export const ensureOptionalFlag = (
  maybeOptionalFlag: unknown,
  path?: Path,
): OptionalFlag => {
  assertOptionalFlag(maybeOptionalFlag, path);

  return maybeOptionalFlag;
};

export const getOptionalFlag = (
  maybeOptionalFlag: OptionalFlag,
  defaultValue: boolean,
  path?: Path,
): boolean => ensureOptionalFlag(maybeOptionalFlag, path) ?? defaultValue;
