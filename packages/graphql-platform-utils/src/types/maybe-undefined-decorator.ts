export type MaybeUndefinedDecorator<TValue, TStrict extends boolean> = TStrict extends true
  ? TValue
  : (TValue | undefined);
