import { Scalar } from '../types/scalar';

export function isScalar(value: unknown): value is Scalar {
  return ['bigint', 'boolean', 'number', 'string'].includes(typeof value);
}
