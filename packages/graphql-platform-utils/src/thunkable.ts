export type Thunkable<T, TArgs extends any[] = []> =
  | ((...args: TArgs) => T)
  | T;

export const resolveThunkable = <T, TArgs extends any[]>(
  thunkable: Thunkable<T, TArgs>,
  ...args: TArgs
): T =>
  typeof thunkable === 'function' ? (thunkable as any)(...args) : thunkable;
