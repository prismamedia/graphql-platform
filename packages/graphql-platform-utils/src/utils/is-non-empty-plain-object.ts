import { POJO } from '../types/pojo';
import { isPlainObject } from './is-plain-object';

export function isNonEmptyPlainObject(value: unknown): value is POJO {
  return isPlainObject(value) && Object.keys(value).length > 0;
}
