export type Listable<T> = T[] | T;

export function resolveListable<T>(listable: Listable<T>): T[] {
  return Array.isArray(listable) ? listable : [listable];
}
