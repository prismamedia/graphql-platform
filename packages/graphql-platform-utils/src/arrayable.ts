export type Arrayable<T> = T[] | T;

export function resolveArrayable<T>(arrayable: Arrayable<T>): T[] {
  return Array.isArray(arrayable) ? arrayable : [arrayable];
}
