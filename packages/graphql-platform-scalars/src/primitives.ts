import { bigintScalarTypesByName } from './primitives/bigints.js';
import { booleanScalarTypesByName } from './primitives/booleans.js';
import { numberScalarTypesByName } from './primitives/numbers.js';
import { stringScalarTypesByName } from './primitives/strings.js';

export * from './primitives/bigints.js';
export * from './primitives/booleans.js';
export * from './primitives/numbers.js';
export * from './primitives/strings.js';

export const primitiveScalarTypesByName = {
  ...bigintScalarTypesByName,
  ...booleanScalarTypesByName,
  ...numberScalarTypesByName,
  ...stringScalarTypesByName,
} as const;

export const primitiveScalarTypes = Object.values(primitiveScalarTypesByName);
