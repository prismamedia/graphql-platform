import { POJO } from '../types/pojo';
import { ValueOf } from '../types/value-of';

export function cleanOwnObject<T extends POJO>(
  object: T,
  filter: (value: ValueOf<T>, key: keyof T) => boolean = value => typeof value !== 'undefined',
): void {
  Object.entries(object).forEach(([key, value]) => !filter(value, key) && delete object[key]);
}
