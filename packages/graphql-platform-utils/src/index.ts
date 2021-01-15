import assert from 'assert';
import didyoumean2, { ReturnTypeEnums, ThresholdTypeEnums } from 'didyoumean2';

export * from './errors';
export * from './graphql';
export * from './object';
export * from './object-field';
export * from './path';

export type OptionalFlagValue = boolean | undefined;

export function getOptionalFlagValue(
  optionalFlagValue: OptionalFlagValue,
  defaultValue: boolean,
): boolean {
  if (optionalFlagValue !== undefined) {
    assert(
      typeof optionalFlagValue === 'boolean',
      `Expects a boolean value, got "${optionalFlagValue}"`,
    );

    return optionalFlagValue;
  }

  return defaultValue;
}

export function didYouMean(needle: string, haystack: Iterable<string>): string {
  return didyoumean2(needle, [...haystack], {
    returnType: ReturnTypeEnums.ALL_SORTED_MATCHES,
    thresholdType: ThresholdTypeEnums.EDIT_DISTANCE,
  }).join(', ');
}

export type ThunkOrValue<T> = (() => T) | T;

export const resolveThunkOrValue = <T>(thunkableValue: ThunkOrValue<T>): T =>
  typeof thunkableValue === 'function'
    ? (thunkableValue as any)()
    : thunkableValue;

export type ArrayOrValue<T> = Array<T> | T;

export const resolveArrayOrValue = <T>(arrayOrValue: ArrayOrValue<T>): T[] =>
  Array.isArray(arrayOrValue) ? arrayOrValue : [arrayOrValue];

export const isIterable = <T>(
  maybeIterable: any,
): maybeIterable is Iterable<T> =>
  maybeIterable != null && typeof maybeIterable[Symbol.iterator] === 'function';
