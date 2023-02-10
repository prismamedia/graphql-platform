export type Thunkable<T, TArgs extends any[] = []> =
  | ((...args: TArgs) => T)
  | T;

export function resolveThunkable<T, TArgs extends any[]>(
  thunkable: Thunkable<T, TArgs>,
  ...args: TArgs
): T {
  return typeof thunkable === 'function'
    ? (thunkable as any)(...args)
    : thunkable;
}
