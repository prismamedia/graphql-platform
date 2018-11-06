import baseIsPlainObject from 'lodash.isplainobject';
import { POJO } from '../types/pojo';

export function isPlainObject(value: unknown): value is POJO {
  return baseIsPlainObject(value);
}
