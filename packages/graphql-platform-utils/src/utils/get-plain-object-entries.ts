import { POJO } from '../types/pojo';

export type Entry<T> = [keyof T, T[keyof T]];

export type Entries<T> = Entry<T>[];

export function getPlainObjectEntries<T extends POJO>(object: T): Entries<T> {
  return Object.entries(object);
}
