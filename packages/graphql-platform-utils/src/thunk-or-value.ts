export type ThunkOrValue<T> = (() => T) | T;

export const resolveThunkOrValue = <T>(thunkableValue: ThunkOrValue<T>): T =>
  typeof thunkableValue === 'function'
    ? (thunkableValue as any)()
    : thunkableValue;
