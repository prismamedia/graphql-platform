import { floatScalarTypes } from './numbers/floats';
import { integerScalarTypes } from './numbers/integers';

export * from './numbers/floats';
export * from './numbers/integers';

export const numberScalarTypes = Object.freeze([
  ...floatScalarTypes,
  ...integerScalarTypes,
]);
