import { bigintScalarTypes } from './primitives/bigints';
import { booleanScalarTypes } from './primitives/booleans';
import { numberScalarTypes } from './primitives/numbers';
import { stringScalarTypes } from './primitives/strings';

export * from './primitives/bigints';
export * from './primitives/booleans';
export * from './primitives/numbers';
export * from './primitives/strings';

export const primitiveScalarTypes = Object.freeze([
  ...bigintScalarTypes,
  ...booleanScalarTypes,
  ...numberScalarTypes,
  ...stringScalarTypes,
]);
