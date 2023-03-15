import { UnexpectedValueError } from '../../error.js';
import type { Path } from '../../path.js';
import { ListableInputType } from './wrapping/listable.js';
import { NonNullableInputType } from './wrapping/non-nullable.js';
import { NonOptionalInputType } from './wrapping/non-optional.js';

export * from './wrapping/listable.js';
export * from './wrapping/non-nillable.js';
export * from './wrapping/non-nullable.js';
export * from './wrapping/non-optional.js';

export type WrappingInputType =
  | ListableInputType
  | NonNullableInputType
  | NonOptionalInputType;

export function isWrappingInputType(
  maybeWrappingInputType: unknown,
): maybeWrappingInputType is WrappingInputType {
  return (
    maybeWrappingInputType instanceof ListableInputType ||
    maybeWrappingInputType instanceof NonNullableInputType ||
    maybeWrappingInputType instanceof NonOptionalInputType
  );
}

export function assertWrappingInputType(
  maybeWrappingInputType: unknown,
  path: Path,
): asserts maybeWrappingInputType is WrappingInputType {
  if (!isWrappingInputType(maybeWrappingInputType)) {
    throw new UnexpectedValueError(
      `a wrapping input type`,
      maybeWrappingInputType,
      { path },
    );
  }
}

export function ensureWrappingInputType(
  maybeWrappingInputType: unknown,
  path: Path,
): WrappingInputType {
  assertWrappingInputType(maybeWrappingInputType, path);

  return maybeWrappingInputType;
}
