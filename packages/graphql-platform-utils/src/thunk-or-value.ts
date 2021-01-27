export type ThunkOrValue<T> = (() => T) | T;

export function resolveThunkOrValue<T>(thunkOrValue: ThunkOrValue<T>): T {
  return typeof thunkOrValue === 'function'
    ? (thunkOrValue as any)()
    : thunkOrValue;
}
