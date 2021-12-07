export type PartialDecorator<
  TValue,
  TPartial extends boolean,
> = TPartial extends true ? Partial<TValue> : TValue;
