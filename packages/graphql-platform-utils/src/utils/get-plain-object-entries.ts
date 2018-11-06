import { POJO } from '../types/pojo';

export type Entry<T extends POJO, K extends keyof T = keyof T> = [K, T[K]];

export function getPlainObjectEntries<T extends POJO>(object: T): Array<Entry<T>> {
  return Object.entries(object);
}
