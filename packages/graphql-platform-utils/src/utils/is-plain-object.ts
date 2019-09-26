import { isPlainObject as baseIsPlainObject } from 'lodash';
import { POJO } from '../types/pojo';

export function isPlainObject(value: unknown): value is POJO {
  return baseIsPlainObject(value);
}
