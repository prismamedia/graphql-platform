export type ArrayOrValue<T> = Array<T> | T;

export function resolveArrayOrValue<T>(arrayOrValue: ArrayOrValue<T>): T[] {
  return Array.isArray(arrayOrValue) ? arrayOrValue : [arrayOrValue];
}
