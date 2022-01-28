import { BigIntType, type BigIntTypeConfig } from './numeric/big-int.js';
import { BooleanType, type BooleanTypeConfig } from './numeric/boolean.js';
import { DecimalType, type DecimalTypeConfig } from './numeric/decimal.js';
import { DoubleType, type DoubleTypeConfig } from './numeric/double.js';
import { FloatType, type FloatTypeConfig } from './numeric/float.js';
import { IntType, type IntTypeConfig } from './numeric/int.js';

export * from './numeric/big-int.js';
export * from './numeric/boolean.js';
export * from './numeric/decimal.js';
export * from './numeric/double.js';
export * from './numeric/float.js';
export * from './numeric/int.js';
export * from './numeric/modifier.js';

export type NumericDataTypeConfig =
  | BigIntTypeConfig
  | BooleanTypeConfig
  | DecimalTypeConfig
  | DoubleTypeConfig
  | FloatTypeConfig
  | IntTypeConfig;

export type NumericDataType =
  | BigIntType
  | BooleanType
  | DecimalType
  | DoubleType
  | FloatType
  | IntType;
