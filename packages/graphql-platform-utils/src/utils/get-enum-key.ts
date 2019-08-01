import { POJO } from '../types/pojo';
import { ValueOf } from '../types/value-of';

export function getEnumKey<TEnumerable extends POJO>(
  value: ValueOf<TEnumerable>,
  enumerable: TEnumerable,
): (keyof TEnumerable) | undefined {
  if (typeof value === 'number') {
    // For numeric enums
    return enumerable[value];
  } else {
    // For string enums
    for (const [k, v] of Object.entries(enumerable)) {
      if (value === v) {
        return k;
      }
    }
  }

  return undefined;
}
