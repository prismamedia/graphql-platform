import { floatScalarTypesByName } from './numbers/floats.js';
import { integerScalarTypesByName } from './numbers/integers.js';

export * from './numbers/floats.js';
export * from './numbers/integers.js';

export const numberScalarTypesByName = {
  ...floatScalarTypesByName,
  ...integerScalarTypesByName,
} as const;
