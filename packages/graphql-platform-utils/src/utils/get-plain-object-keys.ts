import { POJO } from '../types/pojo';

export function getPlainObjectKeys<T extends POJO>(object: T): Array<keyof T> {
  return Object.keys(object);
}
