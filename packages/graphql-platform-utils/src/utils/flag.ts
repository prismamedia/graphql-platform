import { Maybe } from '../types';

export type FlagConfig = Maybe<boolean>;

export function getFlagValue(flag: FlagConfig, defaultValue: boolean): boolean {
  if (typeof flag === 'boolean') {
    return flag;
  }

  if (flag === undefined || flag === null) {
    return defaultValue;
  }

  throw new Error(
    `The flag value "${flag}" of type "${typeof flag}" has to be a boolean, null or undefined.`,
  );
}
