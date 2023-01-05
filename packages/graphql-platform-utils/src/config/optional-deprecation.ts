import { UnexpectedValueError } from '../error.js';
import { isNil, Nillable } from '../nil.js';
import type { Path } from '../path.js';

export type OptionalDeprecation = Nillable<boolean | string>;

export function assertOptionalDeprecation(
  maybeOptionalDeprecation: unknown,
  path: Path,
): asserts maybeOptionalDeprecation is OptionalDeprecation {
  if (
    !isNil(maybeOptionalDeprecation) &&
    typeof maybeOptionalDeprecation !== 'boolean' &&
    typeof maybeOptionalDeprecation !== 'string'
  ) {
    throw new UnexpectedValueError(
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
