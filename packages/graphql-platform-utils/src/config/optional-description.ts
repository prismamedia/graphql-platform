import { UnexpectedValueError } from '../error.js';
import { isNil, type Nillable } from '../nil.js';
import type { Path } from '../path.js';

export type OptionalDescription = Nillable<string>;

export function assertOptionalDescription(
  maybeOptionalDescription: unknown,
  path: Path,
): asserts maybeOptionalDescription is OptionalDescription {
  if (
    !isNil(maybeOptionalDescription) &&
    typeof maybeOptionalDescription !== 'string'
  ) {
    throw new UnexpectedValueError(`a string`, maybeOptionalDescription, {
      path,
    });
  }
}

export function ensureOptionalDescription(
  maybeOptionalDescription: unknown,
  path: Path,
): OptionalDescription {
  assertOptionalDescription(maybeOptionalDescription, path);

  return maybeOptionalDescription;
}

export const getOptionalDescription = (
  maybeOptionalDescription: OptionalDescription,
  path: Path,
): string | undefined =>
  ensureOptionalDescription(maybeOptionalDescription, path) || undefined;
