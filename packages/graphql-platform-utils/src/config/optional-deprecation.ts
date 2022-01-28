import { UnexpectedConfigError } from '../error.js';
import type { Path } from '../path.js';

export type OptionalDeprecation = boolean | string | null | undefined;

export function assertOptionalDeprecation(
  maybeOptionalDeprecation: unknown,
  path: Path,
): asserts maybeOptionalDeprecation is OptionalDeprecation {
  if (
    maybeOptionalDeprecation != null &&
    typeof maybeOptionalDeprecation !== 'boolean' &&
    typeof maybeOptionalDeprecation !== 'string'
  ) {
    throw new UnexpectedConfigError(
      `a boolean or a string`,
      maybeOptionalDeprecation,
      { path },
    );
  }
}

export function ensureOptionalDeprecation(
  maybeOptionalDeprecation: unknown,
  path: Path,
): OptionalDeprecation {
  assertOptionalDeprecation(maybeOptionalDeprecation, path);

  return maybeOptionalDeprecation;
}

export function getOptionalDeprecation(
  maybeOptionalDeprecation: OptionalDeprecation,
  defaultValue: string,
  path: Path,
): string | undefined {
  const optionalDeprecation = ensureOptionalDeprecation(
    maybeOptionalDeprecation,
    path,
  );

  return optionalDeprecation === true
    ? defaultValue
    : optionalDeprecation || undefined;
}
