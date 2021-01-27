import { UnexpectedValueError } from './errors';
import { Path } from './path';

export type OptionalFlag = boolean | undefined;

export function getOptionalFlag(
  value: OptionalFlag,
  defaultValue: boolean,
  path?: Path,
): boolean {
  if (value !== undefined) {
    if (typeof value !== 'boolean') {
      throw new UnexpectedValueError(value, `a boolean`, path);
    }

    return value;
  }

  return defaultValue;
}
