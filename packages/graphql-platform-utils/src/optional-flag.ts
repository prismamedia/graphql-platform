import { UnexpectedValueError } from './errors';

export type OptionalFlag = boolean | undefined;

export function getOptionalFlag(
  value: OptionalFlag,
  defaultValue: boolean,
): boolean {
  if (value !== undefined) {
    if (typeof value !== 'boolean') {
      throw new UnexpectedValueError(value, `a boolean`);
    }

    return value;
  }

  return defaultValue;
}
