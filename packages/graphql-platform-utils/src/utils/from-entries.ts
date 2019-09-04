import { Maybe } from '../types/maybe';

export function fromEntries<TKey extends keyof any, TValue>(
  iterable: Iterable<Maybe<[TKey, TValue | undefined]>>,
): Record<TKey, TValue> {
  return [...iterable].reduce((object, element) => {
    if (element) {
      const [key, value] = element;
      if (typeof value !== 'undefined') {
        object[key] = value;
      }
    }

    return object;
  }, Object.create(null));
}
