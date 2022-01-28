import { UnexpectedConfigError } from '../error.js';
import type { Path } from '../path.js';

export type OptionalDescription = string | null | undefined;

export function assertOptionalDescription(
  maybeOptionalDescription: unknown,
  path: Path,
): asserts maybeOptionalDescription is OptionalDescription {
  if (
    maybeOptionalDescription != null &&
    typeof maybeOptionalDescription !== 'string'
  ) {
    throw new UnexpectedConfigError(`a string`, maybeOptionalDescription, {
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
