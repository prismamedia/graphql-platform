export type ArrayOrValue<T> = Array<T> | T;

export const resolveArrayOrValue = <T>(arrayOrValue: ArrayOrValue<T>): T[] =>
  Array.isArray(arrayOrValue) ? arrayOrValue : [arrayOrValue];
