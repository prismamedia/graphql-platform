export type ThunkOrValue<T, TArgs extends any[] = []> =
  | ((...args: TArgs) => T)
  | T;

export function resolveThunkOrValue<T, TArgs extends any[]>(
  thunkOrValue: ThunkOrValue<T, TArgs>,
  ...args: TArgs
): T {
  return typeof thunkOrValue === 'function'
    ? (thunkOrValue as any)(...args)
    : thunkOrValue;
}
