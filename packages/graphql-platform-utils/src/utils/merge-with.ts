import { mergeWith as baseMergeWith } from 'lodash';
import { POJO } from '../types/pojo';

export function mergeWithCustomizer(a: unknown, b: unknown) {
  return Array.isArray(a) || Array.isArray(b)
    ? [
        ...(Array.isArray(a) ? a : a != null ? [a] : []),
        ...(Array.isArray(b) ? b : b != null ? [b] : []),
      ]
    : undefined;
}

export function mergeWith<
  TObject extends POJO,
  TSource1 extends POJO,
  TSource2 extends POJO
>(object: TObject, source1: TSource1, source2?: TSource2) {
  return typeof source2 === 'undefined'
    ? baseMergeWith(object, source1, mergeWithCustomizer)
    : baseMergeWith(object, source1, source2, mergeWithCustomizer);
}
