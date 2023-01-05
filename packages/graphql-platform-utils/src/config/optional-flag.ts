import { UnexpectedValueError } from '../error.js';
import type { Nil } from '../nil.js';
import type { Path } from '../path.js';

export type OptionalFlag = boolean | Nil;

export function assertOptionalFlag(
  maybeOptionalFlag: unknown,
  path?: Path,
): asserts maybeOptionalFlag is OptionalFlag {
  if (maybeOptionalFlag != null && typeof maybeOptionalFlag !== 'boolean') {
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
